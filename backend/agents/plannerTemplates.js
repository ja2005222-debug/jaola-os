// قوالب المهام المدعومة فعلياً بواسطة الوكلاء
export const SUPPORTED_ACTIONS = {
    coder: ['read_file', 'list_files', 'edit_file', 'create_file', 'delete_file', 'get_status', 'createReadmeFile'],
    deployer: ['run_dev', 'run_build', 'deploy_to_vercel'],
    projectInitializer: ['createNextjsProject'],
    reviewer: ['review_code'],
    qa: ['run_checks']
};

export function getSupportedTasksForAgent(agent) {
    return SUPPORTED_ACTIONS[agent] || [];
}

export function isValidTask(task) {
    const supported = SUPPORTED_ACTIONS[task.agent];
    return supported && supported.includes(task.action);
}
