import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import Project from '../models/Project.js';

export function deployProject({ projectPath, activeProject, currentUser }, io, emitUserProjects) {
    const vercelConfig = { name: `${currentUser}-${activeProject}`, version: 2 };
    fs.writeFileSync(path.join(projectPath, 'vercel.json'), JSON.stringify(vercelConfig));

    exec('vercel --yes --prod', { cwd: projectPath }, async (error, stdout, stderr) => {
        let vercelProductionUrl = '';
        if (!error && stdout) {
            vercelProductionUrl = stdout.trim();
            try { 
                await Project.findOneAndUpdate(
                    { name: activeProject, owner: currentUser }, 
                    { vercelUrl: vercelProductionUrl }
                ); 
            } catch(e) {}
        } else {
            console.error('❌ Vercel Deployment Error Detail:', error || stderr);
        }
        
        io.emit('log', { 
            message: vercelProductionUrl 
                ? `✨ مبروك! الموقع معتمد وعالمي الآن على الرابط: ${vercelProductionUrl}` 
                : `⚠️ لم يتم النشر سحابياً (السبب: ${error ? error.message : 'فشل تنفيذ أمر Vercel'}). لكن الكود محفوظ ومستقر محلياً بنجاح.`,
        });
        await emitUserProjects();
    });
}
