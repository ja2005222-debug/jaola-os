/**
 * 🎨 Frontend Team — يعيد استخدام إطار AgentSpec والمنسّق العام
 */
import { runBackendTeam, teamPlan as genericTeamPlan, planExecution } from '../backendTeam/backendTeam.js';
import { FRONTEND_TEAM, FRONTEND_TEAM_BY_ID } from './specs.js';

export { FRONTEND_TEAM, FRONTEND_TEAM_BY_ID } from './specs.js';

/** خطة فريق الواجهة (بلا تنفيذ) */
export function frontendTeamPlan() {
    return genericTeamPlan(FRONTEND_TEAM);
}

/** تشغيل فريق الواجهة عبر المنسّق العام */
export function runFrontendTeam(goal, opts = {}) {
    return runBackendTeam(goal, { ...opts, team: FRONTEND_TEAM });
}

export { planExecution };
