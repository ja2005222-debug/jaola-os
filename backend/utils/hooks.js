import { Cache } from './performance.js';

const cache = new Cache(30000);

export async function useUser(api) {
    const cached = cache.get('user');
    if (cached) return cached;
    const user = await api.get('/api/user/profile');
    cache.set('user', user);
    return user;
}

export async function useProjects(api) {
    const cached = cache.get('projects');
    if (cached) return cached;
    const projects = await api.get('/api/user/projects');
    cache.set('projects', projects);
    return projects;
}

export async function useTasks(api) {
    const cached = cache.get('tasks');
    if (cached) return cached;
    const tasks = await api.get('/api/tasks');
    cache.set('tasks', tasks);
    return tasks;
}

export async function useActiveProject(api) {
    const cached = cache.get('activeProject');
    if (cached) return cached;
    const project = await api.get('/api/projects/active');
    cache.set('activeProject', project);
    return project;
}

export async function useAgentsHealth(api) {
    const cached = cache.get('agentsHealth');
    if (cached) return cached;
    const health = await api.get('/api/agents/health');
    cache.set('agentsHealth', health);
    return health;
}

export async function useGitStatus(api) {
    const cached = cache.get('gitStatus');
    if (cached) return cached;
    const status = await api.get('/api/git/status');
    cache.set('gitStatus', status);
    return status;
}

export function useClearCache() {
    cache.clear();
}
