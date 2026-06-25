import * as fileEditor from './fileEditor.js';
import { loadKnowledge } from './knowledgeService.js';
import path from 'path';

export async function buildFileContext(filePath) {
    const knowledge = await loadKnowledge();
    let content = '';
    try {
        content = await fileEditor.readFile(filePath);
    } catch(e) {}
    const imports = knowledge.imports?.[filePath] || [];
    const exports = knowledge.exports?.[filePath] || [];
    const relatedComponents = [];
    for (const imp of imports.slice(0, 3)) {
        try {
            const fullPath = path.join(process.env.JAOLA_PATH, imp);
            const compContent = await fileEditor.readFile(fullPath);
            relatedComponents.push({ path: imp, content: compContent.substring(0, 1500) });
        } catch(e) {}
    }
    return { content, imports, exports, relatedComponents };
}
