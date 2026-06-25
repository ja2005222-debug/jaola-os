export async function readFileWithLineNumbers(relativePath) {
  const content = await readFile(relativePath);
  const lines = content.split('\n');
  return lines.map((line, idx) => `${idx+1}: ${line}`).join('\n');
}
export function getProjectPath(projectId) {
  // نحتاج إلى حفظ المشاريع في قاعدة بيانات أو ملف
  // سنبسطها حالياً: افتراض مشروع واحد حتى نكمل
  return process.env.JAOLA_PATH;
}

let currentProjectId = null;
export function setProjectId(id) { currentProjectId = id; }
export function getProjectPath() {
  if (currentProjectId) {
    const { getActiveProject } = require('./projectManager.js');
    const proj = getActiveProject();
    if (proj) return proj.path;
  }
  return process.env.JAOLA_PATH;
}
