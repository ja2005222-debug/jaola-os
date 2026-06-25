import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, '../data/memory.json');

async function loadMemory() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { fixes: [], errors: [], decisions: [] };
  }
}

async function saveMemory(memory) {
  await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

export async function rememberFix(errorMessage, fixApplied) {
  const mem = await loadMemory();
  mem.fixes.push({
    error: errorMessage.substring(0, 500),
    fix: fixApplied,
    timestamp: new Date().toISOString()
  });
  if (mem.fixes.length > 50) mem.fixes = mem.fixes.slice(-50);
  await saveMemory(mem);
}

export async function rememberError(errorMessage) {
  const mem = await loadMemory();
  mem.errors.push({
    error: errorMessage.substring(0, 500),
    timestamp: new Date().toISOString()
  });
  if (mem.errors.length > 50) mem.errors = mem.errors.slice(-50);
  await saveMemory(mem);
}

export async function recallFix(errorMessage) {
  const mem = await loadMemory();
  for (const fix of mem.fixes) {
    if (errorMessage.includes(fix.error.substring(0, 100))) {
      return fix.fix;
    }
  }
  return null;
}

export async function rememberDecision(agent, decision, details = {}) {
  const mem = await loadMemory();
  if (!mem.decisions) mem.decisions = [];
  mem.decisions.push({
    agent,
    decision,
    details,
    timestamp: new Date().toISOString()
  });
  if (mem.decisions.length > 100) mem.decisions = mem.decisions.slice(-100);
  await saveMemory(mem);
}

export async function recallDecision(key) {
  const mem = await loadMemory();
  const decision = mem.decisions.reverse().find(d => d.agent === key);
  return decision ? decision : null;
}
