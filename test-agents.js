import { ceoAgent } from './backend/agents/index.js';

const projectState = {
  name: 'Test Project',
  goal: 'بناء متجر إلكتروني',
  progress: 50,
  tasks: [{ name: 'الصفحة الرئيسية', done: true }, { name: 'المنتجات', done: false }],
  structure: { app: {}, components: {} }
};

const userMessage = 'كم سعر المشروع؟';

const reply = await ceoAgent(projectState, userMessage);
console.log('👔 CEO Reply:', reply);
