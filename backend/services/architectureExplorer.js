import fs from 'fs/promises';
import path from 'path';

export async function buildProjectTree(projectPath) {
  const tree = {};
  async function scan(dir, currentObj) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.next', '.git', 'public'].includes(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        currentObj[entry.name] = {};
        await scan(fullPath, currentObj[entry.name]);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json') || entry.name.endsWith('.css')) {
        if (!currentObj.__files) currentObj.__files = [];
        currentObj.__files.push(entry.name);
      }
    }
  }
  await scan(projectPath, tree);
  return tree;
}
