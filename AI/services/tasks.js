/**
 * Tasks Service - خدمة المهام
 * إدارة المهام والتنفيذ والمراقبة
 */

/**
 * جلب جميع المهام
 * @param {APIClient} api
 * @returns {Promise<Array>}
 */
export async function getAllTasks(api) {
    try {
        return await api.get('/tasks');
    } catch (error) {
        console.error('Failed to fetch tasks:', error);
        return [];
    }
}

/**
 * جلب مهمة محددة
 * @param {APIClient} api
 * @param {string} taskId
 * @returns {Promise<Object>}
 */
export async function getTask(api, taskId) {
    try {
        return await api.get(`/tasks/${taskId}`);
    } catch (error) {
        console.error('Failed to fetch task:', error);
        return null;
    }
}

/**
 * إنشاء مهمة جديدة
 * @param {APIClient} api
 * @param {Object} taskData
 * @returns {Promise<Object>}
 */
export async function createTask(api, taskData) {
    if (!taskData.title) {
        throw new Error('Task title is required');
    }

    try {
        return await api.post('/tasks', taskData);
    } catch (error) {
        console.error('Failed to create task:', error);
        throw error;
    }
}

/**
 * تحديث مهمة
 * @param {APIClient} api
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateTask(api, taskId, updates) {
    try {
        return await api.put(`/tasks/${taskId}`, updates);
    } catch (error) {
        console.error('Failed to update task:', error);
        throw error;
    }
}

/**
 * تحديث حالة المهمة
 * @param {APIClient} api
 * @param {string} taskId
 * @param {string} status - pending, running, completed, failed
 * @returns {Promise<boolean>}
 */
export async function updateTaskStatus(api, taskId, status) {
    try {
        await api.patch(`/tasks/${taskId}/status`, { status });
        return true;
    } catch (error) {
        console.error('Failed to update task status:', error);
        throw error;
    }
}

/**
 * حذف مهمة
 * @param {APIClient} api
 * @param {string} taskId
 * @returns {Promise<boolean>}
 */
export async function deleteTask(api, taskId) {
    try {
        await api.delete(`/tasks/${taskId}`);
        return true;
    } catch (error) {
        console.error('Failed to delete task:', error);
        return false;
    }
}

/**
 * جلب تاريخ المهام
 * @param {APIClient} api
 * @param {Object} filters
 * @returns {Promise<Array>}
 */
export async function getTaskHistory(api, filters = {}) {
    try {
        const query = new URLSearchParams(filters).toString();
        return await api.get(`/tasks/history?${query}`);
    } catch (error) {
        console.error('Failed to fetch task history:', error);
        return [];
    }
}

/**
 * الحصول على إحصائيات المهام
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function getTaskStats(api) {
    try {
        return await api.get('/tasks/stats');
    } catch (error) {
        console.error('Failed to fetch task stats:', error);
        return {};
    }
}

/**
 * تشغيل مهمة
 * @param {APIClient} api
 * @param {string} taskId
 * @returns {Promise<Object>}
 */
export async function runTask(api, taskId) {
    try {
        return await api.post(`/tasks/${taskId}/run`);
    } catch (error) {
        console.error('Failed to run task:', error);
        throw error;
    }
}

/**
 * إلغاء مهمة
 * @param {APIClient} api
 * @param {string} taskId
 * @returns {Promise<boolean>}
 */
export async function cancelTask(api, taskId) {
    try {
        await api.post(`/tasks/${taskId}/cancel`);
        return true;
    } catch (error) {
        console.error('Failed to cancel task:', error);
        return false;
    }
}

/**
 * إعادة محاولة مهمة فاشلة
 * @param {APIClient} api
 * @param {string} taskId
 * @returns {Promise<Object>}
 */
export async function retryTask(api, taskId) {
    try {
        return await api.post(`/tasks/${taskId}/retry`);
    } catch (error) {
        console.error('Failed to retry task:', error);
        throw error;
    }
}

/**
 * الموافقة على مهمة (للمهام التي تحتاج موافقة)
 * @param {APIClient} api
 * @param {string} taskId
 * @param {boolean} approved
 * @returns {Promise<boolean>}
 */
export async function approveTask(api, taskId, approved = true) {
    try {
        await api.post(`/tasks/${taskId}/approve`, { approved });
        return true;
    } catch (error) {
        console.error('Failed to approve task:', error);
        return false;
    }
}

export default {
    getAllTasks,
    getTask,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getTaskHistory,
    getTaskStats,
    runTask,
    cancelTask,
    retryTask,
    approveTask
};
