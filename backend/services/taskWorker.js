import { getPendingTasks, updateTaskStatus, incrementRetries, addTaskLog, getTask } from './taskQueue.js';
import { executeTask } from './taskExecutor.js';
import { broadcastTimeline, broadcastTaskUpdate } from './broadcast.js';

let isRunning = false;

async function executeSingleTask(task) {
    console.log(`⚙️ [Worker] Executing task ${task.id}: ${task.agent}.${task.action}`);
    updateTaskStatus(task.id, 'running');
    addTaskLog(task.id, { level: 'info', message: `Started ${task.action}` });
    broadcastTimeline(`⚙️ بدء تنفيذ المهمة ${task.id}: ${task.action}`, 'info');
    broadcastTaskUpdate(task.id, 'running', { agent: task.agent, action: task.action });

    let oldContent = '';
    const { fileEditor } = await import('./fileEditor.js');
    if (task.action === 'edit_file' && task.params?.path) {
        try { oldContent = await fileEditor.readFile(task.params.path); } catch(e) {}
    }

    try {
        const result = await executeTask(task, {});
        updateTaskStatus(task.id, 'completed', result);
        addTaskLog(task.id, { level: 'info', message: `Completed ${task.action}`, result });
        console.log(`✅ [Worker] Task ${task.id} completed`);
        broadcastTimeline(`✅ اكتملت المهمة ${task.id}: ${task.action}`, 'success');
        broadcastTaskUpdate(task.id, 'completed', { result });

        let newContent = '';
        if (task.action === 'edit_file' && task.params?.path) {
            try { newContent = await fileEditor.readFile(task.params.path); } catch(e) {}
        }
        broadcastTaskUpdate(task.id, 'completed', {
            agent: task.agent,
            action: task.action,
            path: task.params?.path || '',
            oldContent,
            newContent
        });
    } catch (error) {
        console.error('========== TASK ERROR ==========');
        console.error(error);
        console.error(error.stack);
        console.error('===============================');
        addTaskLog(task.id, { level: 'error', message: `Failed: ${error.message}` });
        incrementRetries(task.id);
        broadcastTimeline(`❌ فشلت المهمة ${task.id}: ${error.message}`, 'error');
        broadcastTaskUpdate(task.id, 'failed', { error: error.message });
        const updated = getTask(task.id);
        if (updated && updated.retries >= updated.maxRetries) {
            updateTaskStatus(task.id, 'failed', null, error.message);
            addTaskLog(task.id, { level: 'error', message: `Max retries exceeded` });
            console.error(`💀 [Worker] Task ${task.id} exceeded max retries, marked as failed.`);
            broadcastTaskUpdate(task.id, 'failed', { agent: task.agent, action: task.action, error: error.message });
        } else {
            console.log(`🔄 [Worker] Task ${task.id} will be retried (${updated?.retries || 0}/${updated?.maxRetries || 3})`);
        }
    }
}

async function processTasks() {
    if (isRunning) return;
    isRunning = true;
    try {
        const pendingTasks = getPendingTasks();
        for (const task of pendingTasks) await executeSingleTask(task);
    } catch (err) { console.error('Worker error:', err); }
    finally { isRunning = false; }
}

export function startTaskWorker(intervalMs = 3000) {
    console.log(`🚀 Task Worker started (interval: ${intervalMs}ms)`);
    setInterval(processTasks, intervalMs);
    processTasks();
}
