import { updateContext } from './contextMemory.js';

export async function executeTask(task, context = {}) {
  const { agent, action, params } = task;
  // إذا كان params يحتوي على "refers_to" فيمكنه الرجوع إلى نتيجة مهمة سابقة
  if (params.refers_to && context[params.refers_to]) {
    params.previousResult = context[params.refers_to];
  }
  switch (agent) {
    case 'coder': return await executeCoderTask(action, params, context);
    
if (action === 'edit_file' || action === 'create_file') {
    let filePath = params.path;
    // تصحيح المسار إذا كان Pages Router والمشروع App Router
    if (filePath === 'pages/index.tsx' || filePath === 'pages/index.js') {
        const projectType = await detectRouterType(JAOLA_PATH);
        if (projectType === 'app') {
            filePath = 'app/page.tsx';
            console.log(`[Coder] Path corrected from pages/index.tsx to ${filePath}`);
        }
    }
async function detectRouterType(projectPath) {
    try {
        await fs.access(path.join(projectPath, 'app'));
        return 'app';
    } catch {
        try {
            await fs.access(path.join(projectPath, 'pages'));
            return 'pages';
        } catch {
            return 'unknown';
        }
    }
}
    // ... باقي الكود
}


// ...
  }
}
async function executeCoderTask(action, params) {
  try {
    switch (action) {
      case 'read_file':
        if (!params?.path) throw new Error('Missing path parameter');
        return await fileEditor.readFile(params.path);
      case 'edit_file':
const { gitAddCommitPush } = await import('../agents/git.agent.js');
  await gitAddCommitPush(`AI edit: ${params.path}`, getProjectPath());
  return result;
// داخل case 'edit_file'
if (params.instruction) {
    const { smartEdit } = await import('../agents/coder.agent.js');
    return await smartEdit(params.path, params.instruction, old);
} else {

await updateContext({ lastModifiedFile: filePath, activePage: path.basename(filePath, '.tsx') });
    // التعديل المباشر القديم
}
await updateContext({ activeProjectId: id });

        if (!params?.path || params.content === undefined) throw new Error('Missing path or content');
        return await fileEditor.editFile(params.path, params.content);
      case 'create_file':
        if (!params?.path) throw new Error('Missing path');
        return await fileEditor.createFile(params.p

ath, params.content || '');
case 'qa':
  const { runQAChecks } = await import('../agents/qa.agent.js');
  return await runQAChecks();      

case 'delete_file':
        if (!params?.path) throw new Error('Missing path');
        return await fileEditor.deleteFile(params.path);
case 'read_file':
  if (!params?.path || typeof params.path !== 'string') {
    throw new Error('Invalid or missing path parameter for read_file');
  }
  return await fileEditor.readFile(params.path);

      case 'list_files':
        const { stdout } = await execPromise(`ls -la ${process.env.JAOLA_PATH} | head -30`);
        return stdout;
      default:
        throw new Error(`Unknown coder action: ${action}`);
    }
  } catch (err) {
    // إعادة الخطأ مع رسالة مفهومة
    throw new Error(`[${action}] ${err.message}`);
  }
if (action === 'run_qa' && !result.passed) {
  const { autoFixQA } = await import('../agents/autoFix.agent.js');
  const fixResult = await autoFixQA(result, getActiveProject().path);
  if (fixResult.fixed) return { message: 'AutoFix applied and QA passed', fixResult };
  else throw new Error('QA failed and AutoFix could not resolve');
}
}
