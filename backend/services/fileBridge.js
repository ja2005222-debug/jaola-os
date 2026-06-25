import fs from 'fs/promises';
import path from 'path';

export const fileBridge = {
  // للـ Coder: الكتابة في الملفات
  writeFile: async (filePath, content) => {
    const fullPath = path.join(process.cwd(), 'workspace', filePath);
    await fs.writeFile(fullPath, content);
    return `File ${filePath} updated successfully.`;
  },
  
  // للـ Debugger: قراءة الملفات
  readFile: async (filePath) => {
    const fullPath = path.join(process.cwd(), 'workspace', filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }
};
