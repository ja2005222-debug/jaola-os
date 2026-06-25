import fs from 'fs/promises';
import path from 'path';

export async function generateTree(dirPath: string, basePath: string = ''): Promise<any[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const tree = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.join(basePath, entry.name);
    if (entry.isDirectory()) {
      const children = await generateTree(fullPath, relativePath);
      tree.push({ name: entry.name, path: relativePath, type: 'directory', children });
    } else {
      tree.push({ name: entry.name, path: relativePath, type: 'file' });
    }
  }
  return tree;
}
