/**
 * Projects Service - خدمة المشاريع
 * إدارة المشاريع والملفات والإجراءات المتعلقة بها
 */

import { validateFilePath } from '../utils/security.js';

/**
 * جلب جميع المشاريع
 * @param {APIClient} api - عميل الـ API
 * @returns {Promise<Array>}
 */
export async function getAllProjects(api) {
    try {
        return await api.get('/projects');
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
}

/**
 * جلب المشروع النشط
 * @param {APIClient} api
 * @returns {Promise<Object|null>}
 */
export async function getActiveProject(api) {
    try {
        return await api.get('/projects/active');
    } catch (error) {
        console.error('Failed to fetch active project:', error);
        return null;
    }
}

/**
 * تعيين المشروع النشط
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function setActiveProject(api, projectId) {
    try {
        await api.post(`/projects/active/${projectId}`);
        return true;
    } catch (error) {
        console.error('Failed to set active project:', error);
        return false;
    }
}

/**
 * إنشاء مشروع جديد
 * @param {APIClient} api
 * @param {string} name - اسم المشروع
 * @param {string} path - مسار المشروع
 * @returns {Promise<Object>}
 */
export async function createProject(api, name, path) {
    if (!name || name.length < 3) {
        throw new Error('Project name must be at least 3 characters');
    }

    if (!path || path.length < 3) {
        throw new Error('Project path must be at least 3 characters');
    }

    try {
        return await api.post('/projects', { name, path });
    } catch (error) {
        console.error('Failed to create project:', error);
        throw error;
    }
}

/**
 * حذف مشروع
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<boolean>}
 */
export async function deleteProject(api, projectId) {
    try {
        await api.delete(`/projects/${projectId}`);
        return true;
    } catch (error) {
        console.error('Failed to delete project:', error);
        return false;
    }
}

/**
 * تحديث معلومات المشروع
 * @param {APIClient} api
 * @param {string} projectId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateProject(api, projectId, updates) {
    try {
        return await api.put(`/projects/${projectId}`, updates);
    } catch (error) {
        console.error('Failed to update project:', error);
        throw error;
    }
}

/**
 * جلب شجرة الملفات
 * @param {APIClient} api
 * @param {string} projectId - معرف المشروع (اختياري)
 * @returns {Promise<Array>}
 */
export async function getFileTree(api, projectId = null) {
    try {
        const endpoint = projectId ? `/projects/${projectId}/files` : '/fs/tree/active';
        return await api.get(endpoint);
    } catch (error) {
        console.error('Failed to fetch file tree:', error);
        return [];
    }
}

/**
 * جلب محتوى ملف
 * @param {APIClient} api
 * @param {string} filePath
 * @returns {Promise<Object>}
 */
export async function getFile(api, filePath) {
    try {
        validateFilePath(filePath);
        return await api.get(`/fs/file?path=${encodeURIComponent(filePath)}`);
    } catch (error) {
        console.error('Failed to fetch file:', error);
        throw error;
    }
}

/**
 * حفظ ملف
 * @param {APIClient} api
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>}
 */
export async function saveFile(api, filePath, content) {
    try {
        validateFilePath(filePath);
        await api.post('/save/file', { path: filePath, content });
        return true;
    } catch (error) {
        console.error('Failed to save file:', error);
        throw error;
    }
}

/**
 * إنشاء ملف جديد
 * @param {APIClient} api
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<boolean>}
 */
export async function createFile(api, filePath, content = '') {
    try {
        validateFilePath(filePath);
        await api.post('/create/file', { path: filePath, content });
        return true;
    } catch (error) {
        console.error('Failed to create file:', error);
        throw error;
    }
}

/**
 * حذف ملف
 * @param {APIClient} api
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function deleteFile(api, filePath) {
    try {
        validateFilePath(filePath);
        await api.delete(`/files/${encodeURIComponent(filePath)}`);
        return true;
    } catch (error) {
        console.error('Failed to delete file:', error);
        throw error;
    }
}

/**
 * جلب حالة المشروع (معلومات الأداء)
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<Object>}
 */
export async function getProjectStats(api, projectId) {
    try {
        return await api.get(`/projects/${projectId}/stats`);
    } catch (error) {
        console.error('Failed to fetch project stats:', error);
        return {};
    }
}

/**
 * تشغيل المشروع محلياً
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<Object>} {port, url}
 */
export async function runProject(api, projectId) {
    try {
        return await api.post(`/projects/${projectId}/run`);
    } catch (error) {
        console.error('Failed to run project:', error);
        throw error;
    }
}

/**
 * بناء المشروع
 * @param {APIClient} api
 * @param {string} projectId
 * @returns {Promise<Object>}
 */
export async function buildProject(api, projectId) {
    try {
        return await api.post(`/projects/${projectId}/build`);
    } catch (error) {
        console.error('Failed to build project:', error);
        throw error;
    }
}

/**
 * نشر المشروع
 * @param {APIClient} api
 * @param {string} projectId
 * @param {string} platform - vercel, netlify, github-pages
 * @returns {Promise<Object>}
 */
export async function deployProject(api, projectId, platform = 'vercel') {
    try {
        return await api.post(`/projects/${projectId}/deploy`, { platform });
    } catch (error) {
        console.error('Failed to deploy project:', error);
        throw error;
    }
}

export default {
    getAllProjects,
    getActiveProject,
    setActiveProject,
    createProject,
    deleteProject,
    updateProject,
    getFileTree,
    getFile,
    saveFile,
    createFile,
    deleteFile,
    getProjectStats,
    runProject,
    buildProject,
    deployProject
};
