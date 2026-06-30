import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const memoryDir = path.resolve(__dirname, '../memory');

if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });

export function loadExecutiveMemory(username) {
    const filePath = path.join(memoryDir, 'executive_memory.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const mem = JSON.parse(data || "{}");
        return mem[username] || { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
    }
    return { preferredUi: 'Neon Dark', dislikedTech: 'Bootstrap', language: 'Arabic' };
}

export function saveExecutiveMemory(username, preferredUi) {
    const filePath = path.join(memoryDir, 'executive_memory.json');
    let mem = {};
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        mem = JSON.parse(data || "{}");
    }
    mem[username] = { preferredUi, dislikedTech: 'Bootstrap', language: 'Arabic' };
    fs.writeFileSync(filePath, JSON.stringify(mem, null, 2));
}
