import fs from 'fs/promises';
import path from 'path';

export async function scanProject(projectPath) {
  console.log(`🔍 Scanning project: ${projectPath}`);
  const index = {
    pages: [],
    components: [],
    exports: {},
    imports: {},
    lastScan: new Date().toISOString()
  };

  // فحص مجلد app
  const appDir = path.join(projectPath, 'app');
  try {
    const files = await fs.readdir(appDir, { recursive: true });
    index.pages = files.filter(f => f.endsWith('.tsx') || f.endsWith('.jsx'))
      .map(f => '/app/' + f.replace(/\.(tsx|jsx)$/, ''));
  } catch(e) {}

  // فحص مجلد components
  const compDir = path.join(projectPath, 'components');
  try {
    const files = await fs.readdir(compDir);
    index.components = files.filter(f => f.endsWith('.tsx')).map(f => f.replace('.tsx', ''));
  } catch(e) {}

  // تحليل الملفات
  const allFiles = await getAllFiles(projectPath, ['.ts', '.tsx', '.js', '.jsx']);
  for (const file of allFiles) {
    const content = await fs.readFile(file, 'utf8');
    const exportsList = extractExports(content);
    const importsList = extractImports(content);
    const relativePath = path.relative(projectPath, file);
    if (exportsList.length) index.exports[relativePath] = exportsList;
    if (importsList.length) index.imports[relativePath] = importsList;
  }

  // حفظ قاعدة المعرفة
  await fs.mkdir('./knowledge', { recursive: true });
  await fs.writeFile('./knowledge/project-index.json', JSON.stringify(index, null, 2));
  console.log('✅ Knowledge base created.');
  return index;
}

async function getAllFiles(dir, exts) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next', 'public', '.git'].includes(entry.name)) {
        files.push(...await getAllFiles(full, exts));
      }
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

function extractExports(content) {
  const exports = [];
  const regex = /export\s+(?:default\s+)?(?:function|const|class|let|var)\s+([A-Za-z0-9_]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) exports.push(match[1]);
  return exports;
}

function extractImports(content) {
  const imports = [];
  const regex = /import\s+.*?from\s+['"](.+?)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) imports.push(match[1]);
  return imports;
}
