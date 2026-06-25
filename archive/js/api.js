const API_BASE = '/api';
const TOKEN = localStorage.getItem('token');

export async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function fetchProjects() { return apiFetch('/projects'); }
export async function fetchActiveProject() { return apiFetch('/projects/active'); }
export async function fetchAgents() { return apiFetch('/agents/health'); }
export async function fetchKPIs() { return apiFetch('/kpis'); }
export async function fetchWorkflow() { return apiFetch('/workflow/status/live'); }
export async function fetchDecisions() { return apiFetch('/decisions/center'); }
export async function fetchArchitectureTree() { return apiFetch('/architecture/tree'); }
