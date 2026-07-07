import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { getProjectContext } from './knowledgeEngine.js';

export async function applyTemplate(userGoal, projectPath, typeHint = null) {
    try {
        const ctx = getProjectContext(userGoal, typeHint);

        const initialCSS = `/* JAOLA OS — قالب بداية: ${ctx.projectType} */\n${ctx.cssVariables}\n\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: var(--font); color: var(--text); background: var(--bg); line-height: 1.6; }\n`;

        const cssPath = path.join(projectPath, 'styles.css');
        const cssExists = fs.existsSync(cssPath);
        if (!cssExists || (await fsPromises.readFile(cssPath, 'utf-8')).trim().length < 50) {
            await fsPromises.writeFile(cssPath, initialCSS);
        }

        const indexPath = path.join(projectPath, 'index.html');
        if (!fs.existsSync(indexPath)) {
            await fsPromises.writeFile(indexPath, `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>جاري البناء...</title><link rel="stylesheet" href="styles.css"></head><body></body></html>`);
        }

        return {
            success: true,
            template: ctx.projectType,
            source: 'knowledge-engine',
            context: {
                visualGuide: ctx.mood,
                sections: ctx.mustHaveSections,
                colorScheme: ctx.cssVariables,
                heroImage: ctx.heroImage,
                suggestedIcons: ctx.suggestedIcons
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
