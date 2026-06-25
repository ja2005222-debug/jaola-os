import * as ceo from '../agents/ceo.agent.js';
import * as planner from '../agents/planner.agent.js';
import * as architect from '../agents/architect.agent.js';
import * as coder from '../agents/coder.agent.js';
import * as reviewer from '../agents/reviewer.agent.js';
import * as qa from '../agents/qa.agent.js';
import * as deployer from '../agents/deployer.agent.js';

const agents = {
    CEO: ceo,
    Planner: planner,
    Architect: architect,
    Coder: coder,
    Reviewer: reviewer,
    QA: qa,
    Deployer: deployer
};

export async function executeTask(task) {
    const agent = agents[task.agent];
    if (!agent) throw new Error(`Unknown agent: ${task.agent}`);
    // تنفيذ المهمة باستخدام الوكيل
    const result = await agent.execute(task.task, task.project_id);
    return result;
}
