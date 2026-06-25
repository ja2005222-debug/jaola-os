import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const JAOLA_PATH = process.env.JAOLA_PATH;
const KNOWLEDGE_FILE = './knowledgeBase.json';

// تحليل ملف واحد لجمع معلومات
async function analyzeFile(filePath) {
  const ext = path.extname(filePath);
  if (!['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md'].includes(ext)) return null;
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n').slice(0, 200);
  const info = {
    path: filePath.replace(JAOLA_PATH, ''),
    type: ext,
    exports: [],
    imports: [],
    components: [],
    description: ''
  };
  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    info.imports.push(match[1]);
  }
  const exportRegex = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    info.exports.push(match[1]);
  }
  const componentRegex = /(?:function|const)\s+([A-Z][A-Za-z0-9_]*)\s*[=\(]/g;
  while ((match = componentRegex.exec(content)) !== null) {
    info.components.push(match[1]);
  }
  const firstLine = lines.find(l => l.trim().startsWith('//') || l.trim().startsWith('/*'));
  if (firstLine) info.description = firstLine.replace(/\/\/|\*|\//g, '').trim();
  return info;
}

// فهرسة المشروع بالكامل
async function indexProject() {
  console.log('📇 Indexing project...');
  const allFiles = await execPromise(`find ${JAOLA_PATH} -type f \\( -name "*.tsx" -o -name "*.ts" -o -name "*.js" -o -name "*.jsx" -o -name "*.css" -o -name "*.json" -o -name "*.md" \\) | grep -v node_modules | grep -v .next`);
  const filePaths = allFiles.stdout.split('\n').filter(Boolean);
  const knowledge = [];
  for (const filePath of filePaths.slice(0, 50)) {
    try {
      const info = await analyzeFile(filePath);
      if (info) knowledge.push(info);
    } catch(e) { console.error(`Error indexing ${filePath}:`, e.message); }
  }
  await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(knowledge, null, 2));
  console.log(`✅ Indexed ${knowledge.length} files.`);
  return knowledge;
}

// تحميل قاعدة المعرفة من الملف
async function loadKnowledgeBase() {
  try {
    const data = await fs.readFile(KNOWLEDGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch { return []; }
}

export { indexProject, loadKnowledgeBase };
