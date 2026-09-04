/**
 * ✏️ محرّر ملفات مساحة العمل (JAOLA_PATH) — قراءة/إنشاء/تعديل/حذف بنسخة احتياطية.
 *
 * 🔴 **الحارس كان يمسك الصوت ويترك الهمس.** الاحتواء كان
 * `full.startsWith(base)` — مقارنةُ بادئةٍ **بلا فاصل مسار**. فالمحاولة
 * الصريحة تُمنع (`path.join` يطبّع `..` فيخرج الناتج عن البادئة)، أما
 * الشقيق الذي يبدأ اسمه باسم الجذر فيمرّ:
 *
 *     base = /srv/jaola      '../jaola-evil/x' → /srv/jaola-evil/x → يمرّ
 *
 * مُثبَتٌ بالتشغيل: قرأ ملفاً خارج الجذر بينما ردّ `../../etc/hostname`
 * برسالة «Path traversal denied» — فيبدو الحارس عاملاً وهو مثقوب.
 *
 * وهذا **العطب نفسه** الذي سمّاه `core/runtime/workspacePaths.js` وأصلحه
 * في `writePlanFiles`؛ بقي هنا لأن هذه الوحدة لم يكن يصل إليها الماشي
 * (انظر قسم اليتامى في `ARCHITECTURE_MAP.md`). فتستدعي النواة نفسها الآن:
 * `isInsideRoot` تقارن بفاصل المسار، فلا تُخدع بالبادئة.
 */

import fs from 'fs/promises';
import path from 'path';
import { isInsideRoot } from '../core/runtime/workspacePaths.js';

function getFullPath(relativePath) {
  const base = process.env.JAOLA_PATH;
  if (!base) throw new Error('JAOLA_PATH not set');
  if (typeof relativePath !== 'string') throw new Error('Path must be a string');
  const clean = relativePath.replace(/^\/+/, '');
  const full = path.resolve(base, clean);
  if (!isInsideRoot(base, full)) throw new Error('Path traversal denied');
  return full;
}

export async function readFile(relativePath) {
  const full = getFullPath(relativePath);
  return await fs.readFile(full, 'utf8');
}

export async function editFile(relativePath, newContent) {
  const full = getFullPath(relativePath);
  try {
    await fs.access(full);
  } catch {
    throw new Error(`File does not exist: ${full}`);
  }
  const backup = full + '.bak';
  await fs.copyFile(full, backup);
  await fs.writeFile(full, newContent, 'utf8');
  return { success: true, backupPath: backup };
}

export async function createFile(relativePath, content) {
  const full = getFullPath(relativePath);
  const dir = path.dirname(full);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(full, content, 'utf8');
  return { success: true };
}

export async function deleteFile(relativePath) {
  const full = getFullPath(relativePath);
  const backup = full + '.del.bak';
  await fs.rename(full, backup);
  return { success: true, backupPath: backup };
}

export async function runBuild() {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execPromise = promisify(exec);
  const { stdout, stderr } = await execPromise('npm run build', { cwd: process.env.JAOLA_PATH });
  return { stdout, stderr };
}
