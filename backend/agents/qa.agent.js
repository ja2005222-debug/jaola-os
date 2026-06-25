import { callAI } from '../utils/aiProvider.js';

export async function run(context) {
    const prompt = "You are the qa agent. Mission: " + context.mission + ". Previous history: " + context.history + ". Task: Provide only your role-specific contribution for this mission.";
    return await callAI(prompt);
}
