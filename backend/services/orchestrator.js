import { executeAgent } from '../agents/agentFactory.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const logPath = path.join(process.cwd(), 'logs', 'mission.log');

export async function runPipeline(mission, socketManager) {
if (!fs.existsSync('logs')) fs.mkdirSync('logs');
fs.appendFileSync(logPath, "\n--- [" + new Date().toISOString() + "] Mission: " + mission + " ---\n");

const pipeline = ['Planner', 'Architect', 'Coder'];
let context = { mission, history: "" };

console.log("[JAOLA OS] Starting mission: " + mission);

for (const agentName of pipeline) {
    try {
        const result = await executeAgent(agentName, context);
        context.history += "\n[" + agentName + " Output]: " + result;
        fs.appendFileSync(logPath, "[" + agentName + " Output]: " + result + "\n");
        
        if (agentName === 'Coder') {
            const cleanCode = result.replace(/```python/g, '').replace(/```/g, '');
            const filePath = path.join(process.cwd(), 'data', 'generated_code.py');
            
            if (!fs.existsSync('data')) fs.mkdirSync('data');
            fs.writeFileSync(filePath, cleanCode);
            
            console.log("[File System] Code saved to data/generated_code.py");
            await testAndRepair(filePath, context);
        }
    } catch (e) {
        console.error("[" + agentName + "] Error: " + e.message);
        fs.appendFileSync(logPath, "[ERROR] " + agentName + ": " + e.message + "\n");
    }
}
}

async function testAndRepair(filePath, context) {
exec("python3 " + filePath, (error, stdout, stderr) => {
if (stderr) {
fs.appendFileSync(logPath, "[SELF-HEALING ERROR]: " + stderr + "\n");
console.log("[Self-Healing] Detected error, logging for repair...");
} else {
fs.appendFileSync(logPath, "[SUCCESS]: Code executed successfully.\n");
console.log("[Self-Healing] Code passed successfully!");
}
});
}
