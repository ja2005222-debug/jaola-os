/**
 * React-style Hooks - خطافات لإدارة البيانات والحالة
 * توفر طريقة موحدة وآمنة للوصول للبيانات
 */

import { Cache } from './performance.js';

const dataCache = new Cache(300000); // 5 دقائق

/**
 * استجلاب بيانات المستخدم
 * @param {APIClient} api - عميل API
 * @returns {Promise<Object>} بيانات المستخدم
 */
export async function useUser(api) {
    try {
        // التحقق من الـ cache أولاً
        const cached = dataCache.get('user');
        if (cached) return cached;

        const user = await api.get('/user/profile');
        dataCache.set('user', user, 600000); // 10 دقائق
        return user;
    } catch (error) {
        console.error('Failed to load user:', error);
        return null;
    }
}

/**
 * استجلاب المشاريع
 * @param {APIClient} api
 * @returns {Promise<Array>}
 */
export async function useProjects(api) {
    try {
        const cached = dataCache.get('projects');
        if (cached) return cached;

        const projects = await api.get('/projects');
        dataCache.set('projects', projects, 300000); // 5 دقائق
        return projects;
    } catch (error) {
        console.error('Failed to load projects:', error);
        return [];
    }
}

/**
 * استجلاب المشروع النشط
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function useActiveProject(api) {
    try {
        const cached = dataCache.get('activeProject');
        if (cached) return cached;

        const project = await api.get('/projects/active');
        dataCache.set('activeProject', project, 60000); // دقيقة واحدة (يتغير بسرعة)
        return project;
    } catch (error) {
        console.error('Failed to load active project:', error);
        return null;
    }
}

/**
 * استجلاب المهام
 * @param {APIClient} api
 * @returns {Promise<Array>}
 */
export async function useTasks(api) {
    try {
        const cached = dataCache.get('tasks');
        if (cached) return cached;

        const tasks = await api.get('/tasks');
        dataCache.set('tasks', tasks, 30000); // 30 ثانية (يتغير بسرعة)
        return tasks;
    } catch (error) {
        console.error('Failed to load tasks:', error);
        return [];
    }
}

/**
 * استجلاب حالة الوكلاء
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function useAgentsHealth(api) {
    try {
        const cached = dataCache.get('agentsHealth');
        if (cached) return cached;

        const health = await api.get('/agents/health');
        dataCache.set('agentsHealth', health, 10000); // 10 ثوانٍ
        return health;
    } catch (error) {
        console.error('Failed to load agents health:', error);
        return {};
    }
}

/**
 * استجلاب حالة Git
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function useGitStatus(api) {
    try {
        const cached = dataCache.get('gitStatus');
        if (cached) return cached;

        const status = await api.get('/git/status');
        dataCache.set('gitStatus', status, 30000); // 30 ثانية
        return status;
    } catch (error) {
        console.error('Failed to load git status:', error);
        return null;
    }
}

/**
 * استجلاب قائمة الملفات
 * @param {APIClient} api
 * @returns {Promise<Array>}
 */
export async function useFileTree(api) {
    try {
        const cached = dataCache.get('fileTree');
        if (cached) return cached;

        const tree = await api.get('/fs/tree/active');
        dataCache.set('fileTree', tree, 120000); // دقيقتان
        return tree;
    } catch (error) {
        console.error('Failed to load file tree:', error);
        return [];
    }
}

/**
 * استجلاب محتوى ملف
 * @param {APIClient} api
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
export async function useFileContent(api, filePath) {
    try {
        const cacheKey = `file:${filePath}`;
        const cached = dataCache.get(cacheKey);
        if (cached) return cached;

        const file = await api.get(`/fs/file?path=${encodeURIComponent(filePath)}`);
        dataCache.set(cacheKey, file, 300000); // 5 دقائق
        return file;
    } catch (error) {
        console.error(`Failed to load file ${filePath}:`, error);
        return null;
    }
}

/**
 * استجلاب الـ KPIs
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function useKPIs(api) {
    try {
        const cached = dataCache.get('kpis');
        if (cached) return cached;

        const kpis = await api.get('/kpis');
        dataCache.set('kpis', kpis, 60000); // دقيقة واحدة
        return kpis;
    } catch (error) {
        console.error('Failed to load KPIs:', error);
        return {};
    }
}

/**
 * تحديث المشروع النشط
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function useSetActiveProject(api, projectId) {
    try {
        await api.post(`/projects/active/${projectId}`);
        // تنظيف الـ cache المرتبط
        dataCache.delete('activeProject');
        dataCache.delete('fileTree');
        dataCache.delete('gitStatus');
        dataCache.delete('tasks');
        return true;
    } catch (error) {
        console.error('Failed to set active project:', error);
        return false;
    }
}

/**
 * حفظ ملف
 * @param {APIClient} api
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>}
 */
export async function useSaveFile(api, filePath, content) {
    try {
        await api.post('/save/file', { path: filePath, content });
        // تنظيف الـ cache
        dataCache.delete(`file:${filePath}`);
        return true;
    } catch (error) {
        console.error('Failed to save file:', error);
        return false;
    }
}

/**
 * تنظيف الـ cache
 */
export function useClearCache() {
    dataCache.clear();
    console.log('Cache cleared');
}

/**
 * إحصائيات الـ cache
 */
export function useCacheStats() {
    return dataCache.stats();
}

export default {
    useUser,
    useProjects,
    useActiveProject,
    useTasks,
    useAgentsHealth,
    useGitStatus,
    useFileTree,
    useFileContent,
    useKPIs,
    useSetActiveProject,
    useSaveFile,
    useClearCache,
    useCacheStats
};
