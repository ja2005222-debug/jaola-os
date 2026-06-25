import express from 'express';
import { createPlan } from '../agents/planner.agent.js';
import { addTask, addPlan } from '../services/taskQueue.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { message } = req.body;
  // يمكن الحصول على userId من التوكن إذا تم تمريره – لكن في الـ API المباشر قد لا يكون موجوداً
  // سنجعله اختيارياً
  const userId = req.userId || null;
  try {
    const plan = await createPlan(message);
    console.log(`[Chat] Plan: ${plan.goal}, tasks: ${plan.tasks?.length}`);

    if (!plan.tasks || plan.tasks.length === 0) {
      plan.tasks = [{ agent: "coder", action: "list_files", params: {} }];
    }

    // حفظ الخطة مع userId
    const savedPlan = await addPlan({ goal: plan.goal, tasks: plan.tasks.map(t => t.id), userId });
    // حفظ المهام مع نفس userId
    for (const task of plan.tasks) {
      await addTask({ ...task, userId });
    }
    res.json({ reply: `📋 تم التخطيط: ${plan.goal} (${plan.tasks.length} مهمة)`, planId: savedPlan.id });
  } catch (err) {
    console.error(`[Chat] Error: ${err.message}`);
    res.json({ reply: `❌ خطأ: ${err.message}` });
  }
});

export default router;

