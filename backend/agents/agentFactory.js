import * as Planner from './planner.agent.js';
import * as Architect from './architect.agent.js';
import * as Coder from './coder.agent.js';
import * as Reviewer from './reviewer.agent.js';
import * as QA from './qa.agent.js';
import * as Deployer from './deployer.agent.js';
import * as Educator from './educator.agent.js'; // استيراد الوكيل الجديد

export const agents = {
    Planner,
    Architect,
    Coder,
    Reviewer,
    QA,
    Deployer,
    Educator
};

export async function executeAgent(name, input) {
    if (!agents[name]) throw new Error(`Agent ${name} not found.`);
    return await agents[name].run(input);
}
