/**
 * Agents Service - خدمة الوكلاء
 * إدارة وكلاء الذكاء الاصطناعي
 */

/**
 * جلب صحة جميع الوكلاء
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function getAgentsHealth(api) {
    try {
        return await api.get('/agents/health');
    } catch (error) {
        console.error('Failed to fetch agents health:', error);
        return {};
    }
}

/**
 * جلب معلومات وكيل محدد
 * @param {APIClient} api
 * @param {string} agentName - اسم الوكيل (Planner, Coder, Reviewer, QA, etc.)
 * @returns {Promise<Object>}
 */
export async function getAgentInfo(api, agentName) {
    try {
        return await api.get(`/agents/${agentName}`);
    } catch (error) {
        console.error(`Failed to fetch agent info for ${agentName}:`, error);
        return null;
    }
}

/**
 * جلب سجل الوكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @param {Object} options - {limit, offset, status}
 * @returns {Promise<Array>}
 */
export async function getAgentLog(api, agentName, options = {}) {
    try {
        const query = new URLSearchParams(options).toString();
        return await api.get(`/agents/${agentName}/log?${query}`);
    } catch (error) {
        console.error(`Failed to fetch log for ${agentName}:`, error);
        return [];
    }
}

/**
 * جلب إحصائيات الوكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<Object>}
 */
export async function getAgentStats(api, agentName) {
    try {
        return await api.get(`/agents/${agentName}/stats`);
    } catch (error) {
        console.error(`Failed to fetch stats for ${agentName}:`, error);
        return {};
    }
}

/**
 * إيقاف وكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<boolean>}
 */
export async function stopAgent(api, agentName) {
    try {
        await api.post(`/agents/${agentName}/stop`);
        return true;
    } catch (error) {
        console.error(`Failed to stop agent ${agentName}:`, error);
        return false;
    }
}

/**
 * بدء وكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<boolean>}
 */
export async function startAgent(api, agentName) {
    try {
        await api.post(`/agents/${agentName}/start`);
        return true;
    } catch (error) {
        console.error(`Failed to start agent ${agentName}:`, error);
        return false;
    }
}

/**
 * إعادة تعيين وكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<boolean>}
 */
export async function resetAgent(api, agentName) {
    try {
        await api.post(`/agents/${agentName}/reset`);
        return true;
    } catch (error) {
        console.error(`Failed to reset agent ${agentName}:`, error);
        return false;
    }
}

/**
 * جلب نسبة نجاح الوكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<number>} النسبة المئوية
 */
export async function getAgentSuccessRate(api, agentName) {
    try {
        const stats = await getAgentStats(api, agentName);
        return stats.successRate || 0;
    } catch (error) {
        console.error(`Failed to get success rate for ${agentName}:`, error);
        return 0;
    }
}

/**
 * جلب قائمة الوكلاء المتاحة
 * @param {APIClient} api
 * @returns {Promise<Array>}
 */
export async function getAvailableAgents(api) {
    try {
        const health = await getAgentsHealth(api);
        return Object.keys(health);
    } catch (error) {
        console.error('Failed to fetch available agents:', error);
        return [];
    }
}

/**
 * جلب جدول الوكلاء (العملات التي يعمل عليها كل وكيل)
 * @param {APIClient} api
 * @returns {Promise<Object>}
 */
export async function getAgentQueue(api) {
    try {
        return await api.get('/agents/queue');
    } catch (error) {
        console.error('Failed to fetch agent queue:', error);
        return {};
    }
}

/**
 * مسح جدول الوكيل
 * @param {APIClient} api
 * @param {string} agentName
 * @returns {Promise<boolean>}
 */
export async function clearAgentQueue(api, agentName) {
    try {
        await api.post(`/agents/${agentName}/queue/clear`);
        return true;
    } catch (error) {
        console.error(`Failed to clear queue for ${agentName}:`, error);
        return false;
    }
}

export default {
    getAgentsHealth,
    getAgentInfo,
    getAgentLog,
    getAgentStats,
    stopAgent,
    startAgent,
    resetAgent,
    getAgentSuccessRate,
    getAvailableAgents,
    getAgentQueue,
    clearAgentQueue
};
