/**
 * 🔐 Auth Agent — JAOLA OS
 *
 * يُضيف نظام مصادقة كامل تلقائياً:
 * - JWT Authentication
 * - تسجيل دخول / تسجيل حساب
 * - حماية المسارات
 * - Middleware للتحقق من الهوية
 */

import { groq } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 كشف هل المشروع يحتاج مصادقة
// ═══════════════════════════════════════════════════════
const AUTH_KEYWORDS = [
    'تسجيل دخول', 'تسجيل حساب', 'حساب مستخدم', 'لوحة تحكم',
    'admin', 'إدارة', 'عضوية', 'اشتراك', 'مستخدمين',
    'login', 'signup', 'register', 'dashboard', 'members',
    'account', 'profile', 'authentication', 'auth', 'users'
];

export function needsAuth(userGoal) {
    const goal = (userGoal || '').toLowerCase();
    return AUTH_KEYWORDS.some(kw => goal.includes(kw));
}

// ═══════════════════════════════════════════════════════
// 📁 ملفات Auth الجاهزة
// ═══════════════════════════════════════════════════════
const AUTH_FILES = {
    // Middleware للتحقق من JWT
    'api/middleware/auth.js': `
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jaola-secret-key-change-in-production';

export function verifyToken(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (e) {
        res.status(401).json({ error: 'جلسة منتهية — يرجى تسجيل الدخول مجدداً' });
    }
}`.trim(),

    // User Model
    'api/models/User.js': `
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar: String,
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// تشفير كلمة المرور قبل الحفظ
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// مقارنة كلمة المرور
UserSchema.methods.comparePassword = async function(password) {
    return bcrypt.compare(password, this.password);
};

export default mongoose.model('User', UserSchema);`.trim(),

    // Auth Routes
    'api/auth.js': `
import express from 'express';
import jwt from 'jsonwebtoken';
import User from './models/User.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'jaola-secret-key-change-in-production';
const JWT_EXPIRES = '7d';

// تسجيل حساب جديد
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
        }
        const exists = await User.findOne({ email });
        if (exists) return res.status(409).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });

        const user = await User.create({ name, email, password });
        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        res.status(201).json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في إنشاء الحساب' });
    }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'البريد وكلمة المرور مطلوبان' });

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
        }
        if (!user.isActive) return res.status(403).json({ error: 'الحساب موقوف' });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        res.json({
            success: true,
            token,
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في تسجيل الدخول' });
    }
});

// الملف الشخصي (محمي)
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في جلب الملف الشخصي' });
    }
});

export default router;`.trim(),

    // Auth UI — نموذج تسجيل دخول HTML
    'auth.html': `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تسجيل الدخول</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary, #1e40af), var(--secondary, #1e3a8a)); }
        .auth-card { background: #fff; border-radius: 20px; padding: 2.5rem; width: 100%; max-width: 420px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
        .auth-logo { text-align: center; font-size: 1.8rem; font-weight: 700; color: var(--primary, #1e40af); margin-bottom: 1.5rem; }
        .tabs { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 12px; margin-bottom: 1.5rem; }
        .tab { flex: 1; padding: 0.6rem; border: none; border-radius: 8px; cursor: pointer; font-family: 'Cairo', sans-serif; font-size: 0.9rem; background: transparent; transition: all 0.2s; }
        .tab.active { background: #fff; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .form-group { margin-bottom: 1rem; }
        .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; }
        .form-group input { width: 100%; padding: 0.75rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Cairo', sans-serif; font-size: 0.95rem; transition: border-color 0.2s; outline: none; }
        .form-group input:focus { border-color: var(--primary, #1e40af); }
        .btn-auth { width: 100%; padding: 0.9rem; background: var(--primary, #1e40af); color: #fff; border: none; border-radius: 10px; font-family: 'Cairo', sans-serif; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.3s; margin-top: 0.5rem; }
        .btn-auth:hover { opacity: 0.9; transform: translateY(-1px); }
        .message { padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.85rem; margin-top: 1rem; display: none; }
        .message.error { background: #fef2f2; color: #dc2626; display: block; }
        .message.success { background: #f0fdf4; color: #16a34a; display: block; }
    </style>
</head>
<body>
<div class="auth-card">
    <div class="auth-logo">🔐 دخول آمن</div>
    <div class="tabs">
        <button class="tab active" onclick="switchTab('login')">تسجيل الدخول</button>
        <button class="tab" onclick="switchTab('register')">حساب جديد</button>
    </div>
    <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="loginEmail" required placeholder="example@email.com"></div>
        <div class="form-group"><label>كلمة المرور</label><input type="password" id="loginPass" required placeholder="••••••••"></div>
        <button type="submit" class="btn-auth">دخول</button>
    </form>
    <form id="registerForm" style="display:none" onsubmit="handleRegister(event)">
        <div class="form-group"><label>الاسم الكامل</label><input type="text" id="regName" required placeholder="محمد أحمد"></div>
        <div class="form-group"><label>البريد الإلكتروني</label><input type="email" id="regEmail" required placeholder="example@email.com"></div>
        <div class="form-group"><label>كلمة المرور</label><input type="password" id="regPass" required placeholder="6 أحرف على الأقل" minlength="6"></div>
        <button type="submit" class="btn-auth">إنشاء حساب</button>
    </form>
    <div id="authMessage" class="message"></div>
</div>
<script>
const API = '/api';
function switchTab(tab) {
    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
    document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register')));
    document.getElementById('authMessage').className = 'message';
}
function showMsg(msg, type) {
    const el = document.getElementById('authMessage');
    el.textContent = msg;
    el.className = 'message ' + type;
}
async function handleLogin(e) {
    e.preventDefault();
    const res = await fetch(API + '/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: loginEmail.value, password: loginPass.value }) });
    const data = await res.json();
    if (data.success) { localStorage.setItem('token', data.token); showMsg('تم الدخول بنجاح! جاري التحويل...', 'success'); setTimeout(() => location.href = 'index.html', 1000); }
    else showMsg(data.error || 'خطأ في تسجيل الدخول', 'error');
}
async function handleRegister(e) {
    e.preventDefault();
    const res = await fetch(API + '/auth/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: regName.value, email: regEmail.value, password: regPass.value }) });
    const data = await res.json();
    if (data.success) { localStorage.setItem('token', data.token); showMsg('تم إنشاء حسابك! جاري التحويل...', 'success'); setTimeout(() => location.href = 'index.html', 1000); }
    else showMsg(data.error || 'خطأ في إنشاء الحساب', 'error');
}
</script>
</body>
</html>`.trim(),
};

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function generateAuth(userGoal, projectPath) {
    const files = [];

    for (const [filename, content] of Object.entries(AUTH_FILES)) {
        files.push({ name: filename, content });
    }

    // package additions note
    files.push({
        name: 'AUTH_README.md',
        content: `# نظام المصادقة

## المتطلبات
\`\`\`bash
npm install jsonwebtoken bcryptjs
\`\`\`

## متغيرات البيئة
\`\`\`
JWT_SECRET=your-super-secret-key-here
MONGODB_URI=mongodb+srv://...
\`\`\`

## الملفات المُنشأة
- \`api/auth.js\` — مسارات تسجيل الدخول والحساب
- \`api/models/User.js\` — نموذج المستخدم
- \`api/middleware/auth.js\` — التحقق من JWT
- \`auth.html\` — صفحة تسجيل الدخول
`
    });

    return {
        success: true,
        files,
        summary: `JWT Auth — ${files.length} ملف (login, register, middleware, UI)`
    };
}
