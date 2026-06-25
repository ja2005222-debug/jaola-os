import { initWebSocket } from './websocket.js';
import { fetchProjects, fetchAgents, fetchKPIs } from './api.js';
import { renderDashboard, renderProjectsList, renderAgentsGrid } from './dashboard.js';
import { initAgentModule } from './agents.js';
import { initArchitectureModule } from './architecture.js';
import { initDecisionsModule } from './decisions.js';
import { initHealthModule } from './health.js';

// التهيئة العامة
document.addEventListener('DOMContentLoaded', async () => {
    initWebSocket();
    await renderDashboard();
    initAgentModule();
    initArchitectureModule();
    initDecisionsModule();
    initHealthModule();
});
