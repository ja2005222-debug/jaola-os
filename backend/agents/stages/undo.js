/**
 * ⏪ stages/undo.js — «تراجع»: استرجاعٌ حتميّ فوريّ لآخر نسخةٍ احتياطيّة كاملة —
 * لا تفسيرَ ذكاء، لا مجالَ لانحراف: نسخة، استرجاع، انتهى.
 *
 * سادسُ ما يخرج من `JaolaCognitiveRuntime` (JCR/9) وأوّلُ **معالجِ نيّة** يخرج:
 * قِيس: `this` = البثُّ وحدَه (٦ `reporter.send` + `emitLiveLog`)، مستدعٍ واحد
 * (`handleUserMessage`)، ووسيطُ `agents` لم يكن يُقرأ فسقط من التوقيع الحرّ.
 * نقلٌ حرفيّ. يعيد `true` إن التقط الأمرَ (رُدَّ عليه)، و`false` إن لم يكن تراجعاً.
 */
import fs from 'fs';
import { getUserLanguage } from '../languageDetector.js';
import { isUndoCommand } from '../chatCommands.js';
import { listSnapshots, restoreSnapshot } from '../fileManager.js';
import { snapshotWorkspace } from '../../services/workspaceStore.js';

export async function handleUndo(req, reporter) {
    const { message, roomName, projectPath, username, activeProject, userLang } = req;
    // ⏪ "تراجع/استرجع/undo" — استرجاع حتمي فوري لآخر نسخة احتياطية كاملة
    // (شبكة أمان من الشات مكافئة لـ Version Restore عند المنافسين):
    // لا تفسير ذكاء، لا مجال لانحراف — نسخة، استرجاع، انتهى.
    if (isUndoCommand(message)) {
        const lang = getUserLanguage(username) || userLang;
        try {
            const snaps = await listSnapshots(projectPath);
            const latest = snaps.snapshots?.[0];
            if (!latest) {
                reporter.send(roomName, 'chat_reply', {
                    message: lang === 'en'
                        ? 'No saved snapshot yet — snapshots are taken automatically before every upcoming edit, so "undo" will work from the next change onward.'
                        : 'لا توجد نسخة سابقة محفوظة بعد — النسخ تُلتقط تلقائياً قبل كل تعديل قادم، فأمر «تراجع» سيعمل من التعديل التالي فصاعداً.',
                });
                return true;
            }
            const r = await restoreSnapshot(projectPath, latest.name);
            if (!r.success) {
                reporter.send(roomName, 'chat_reply', {
                    message: lang === 'en' ? `❌ Restore failed: ${r.error}` : `❌ تعذّر الاسترجاع: ${r.error}`,
                });
                return true;
            }
            // ما لم يُسترجَع يُقال، فلا يُقرأ «✅» على استرجاعٍ ناقص.
            const rest = r.notRestored?.length
                ? ` — و${r.notRestored.length} ملفاً لم تشملها النسخة فبقيت كما هي (${r.notRestored.slice(0, 5).join('، ')}${r.notRestored.length > 5 ? '…' : ''})`
                : '';
            reporter.liveLog(roomName, 'EDIT', 'Undo', `⏪ استُرجعت النسخة ${latest.name} (${r.restored.length} ملف)${rest}.`);
            reporter.send(roomName, 'preview_updated', { timestamp: Date.now() });
            let undoFiles = [];
            try { undoFiles = fs.readdirSync(projectPath).filter(f => !f.startsWith('.') && f !== 'node_modules'); } catch {}
            reporter.send(roomName, 'workspace_files', undoFiles);
            snapshotWorkspace(username, activeProject, projectPath).catch(() => {});
            reporter.send(roomName, 'chat_reply', {
                message: lang === 'en'
                    ? `⏪ Done — restored the previous snapshot (${new Date(latest.timestamp).toLocaleString()}), ${r.restored.length} files. Preview updated.`
                    : `⏪ تم — استُرجعت النسخة السابقة (${new Date(latest.timestamp).toLocaleString('ar')})، ${r.restored.length} ملفاً. المعاينة تحدّثت.`,
            });
        } catch (e) {
            reporter.send(roomName, 'chat_reply', {
                message: lang === 'en' ? `❌ Restore failed: ${e.message}` : `❌ تعذّر الاسترجاع: ${e.message}`,
            });
        }
        return true;
    }
    return false;
}
