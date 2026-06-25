import { queryGroqJSON } from '../services/groqService.js';
import { getActiveProjectTwin } from '../services/twin.js';
import { rememberDecision } from '../services/memory.js';
import { getActiveProject } from '../services/projectManager.js';

export async function analyzeBusinessGoal(userMessage, projectId = null) {
    let twin = null;
    try {
        if (!projectId) {
            const project = getActiveProject();
            if (project) projectId = project.id;
        }
        if (projectId) twin = await getActiveProjectTwin();
    } catch (err) { console.warn('Could not load twin', err); }

    const prompt = `You are a CEO Agent for "JAOLA OS". Analyze the user's business goal and produce a structured plan.

User: "${userMessage}"

${twin ? `Current project context (Twin): pages=${twin.pages?.length || 0}, components=${twin.components?.length || 0}, businessGoals=${JSON.stringify(twin.businessGoals)}` : ''}

Output JSON with exactly this structure:
{
  "goal": "Clear one-sentence goal",
  "businessModel": "e.g., affiliate, subscription, ads",
  "revenueTarget": 5000,
  "featuresRoadmap": ["Feature A", "Feature B"],
  "seoStrategy": ["keyword1", "keyword2"],
  "affiliateStrategy": ["program name", "commission rate"],
  "launchPlan": ["step1", "step2"],
  "tasks": [
    { "agent": "coder", "action": "create_file", "params": { "path": "app/page.tsx", "content": "" } }
  ]
}`;

    const result = await queryGroqJSON(prompt, 0.2);
    
    if (projectId) {
        await rememberDecision(projectId, `CEO Plan: ${result.goal}`, userMessage, { revenueTarget: result.revenueTarget });
    }
    
    return result;
}
