import fs from 'fs/promises';
import path from 'path';

export async function logActivity(action, agentName) {
  const logFile = path.join(process.cwd(), 'workspace', 'analytics.json');
  try {
    const logs = await fs.readFile(logFile, 'utf-8').catch(() => '[]');
    const data = JSON.parse(logs);
    data.push({ timestamp: new Date().toISOString(), action, agentName });
    await fs.writeFile(logFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("خطأ في تسجيل البيانات:", error);
  }
}
