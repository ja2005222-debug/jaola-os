import express from 'express';
import { queryGroq } from '../services/groqService.js';

const router = express.Router();

router.post('/explain', async (req, res) => {
    const { message, planId, history } = req.body;
    let ctx = '';
    if (history?.length) ctx = history.map(h => `${h.role === 'user' ? 'المستخدم' : 'النظام'}: ${h.content}`).join('\n');
    const prompt = `أنت مساعد خبير في Next.js. المحادثة السابقة:\n${ctx || 'لا توجد'}\nالطلب: "${message}"\nتم إنشاء خطة برقم ${planId}. اشرح بإيجاز ما سيحدث.`;
    try {
        const reply = await queryGroq(prompt, 0.7);
        res.json({ reply });
    } catch (err) { res.json({ reply: `✅ تم إنشاء خطة (${planId}) سيتم تنفيذها.` }); }
});

router.post('/ask', async (req, res) => {
    const { question } = req.body;
    try {
        const answer = await queryGroq(`أجب بشكل مفيد وموجز: ${question}`, 0.5);
        res.json({ answer });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
