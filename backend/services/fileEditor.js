import fs from 'fs/promises';
import path from 'path';

function getFullPath(relativePath) {
  const base = process.env.JAOLA_PATH;
  if (!base) throw new Error('JAOLA_PATH not set');
  const clean = relativePath.replace(/^\/+/, '');
  const full = path.join(base, clean);
  if (!full.startsWith(base)) throw new Error('Path traversal denied');
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
