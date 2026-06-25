
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const JAOLA_PATH = process.env.JAOLA_PATH;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

export async function deployToVercel(env = {}) {
  try {
    // استخدام npx vercel لأننا ثبّتناه محلياً
    const cmd = `npx vercel --prod --token ${VERCEL_TOKEN} --cwd ${JAOLA_PATH} --yes`;
    const { stdout, stderr } = await execPromise(cmd);
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getLastDeployUrl() {
  const cmd = `npx vercel list --token ${VERCEL_TOKEN} --cwd ${JAOLA_PATH} --limit 1`;
  const { stdout } = await execPromise(cmd);
  const match = stdout.match(/https:\/\/[\w-]+\.vercel\.app/);
  return match ? match[0] : null;
}
