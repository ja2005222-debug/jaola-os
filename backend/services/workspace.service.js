import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_WORKSPACE = path.resolve(__dirname, '../workspace');

if (!fs.existsSync(BASE_WORKSPACE)) fs.mkdirSync(BASE_WORKSPACE);

export function getProjectPath(username, activeProject) {
    const user = username || 'guest_user';
    const userPath = path.join(BASE_WORKSPACE, user);
    if (!fs.existsSync(userPath)) fs.mkdirSync(userPath, { recursive: true });
    const projectPath = path.join(userPath, activeProject || 'sandbox_app');
    if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });
    return projectPath;
}
