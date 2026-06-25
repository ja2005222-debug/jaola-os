import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export async function validateBuild() {
    const packageJsonPath = path.join(process.env.JAOLA_PATH, 'package.json');

    try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        if (!packageJson.scripts || !packageJson.scripts.build) {
            return { success: true, output: 'No build script found, skipping validation' };
        }
        const result = await execAsync(
            `cd "${process.env.JAOLA_PATH}" && npm run build 2>&1`,
            { maxBuffer: 1024 * 1024 * 20 }
        );
        return { success: true, output: result.stdout };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || error.stderr || error.message
        };
    }
}
