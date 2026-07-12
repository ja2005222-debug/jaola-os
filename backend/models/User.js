import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String }, // bcrypt hash — اختياري لحسابات OAuth
    provider: { type: String, default: 'local' }, // 'local' | 'github' | 'google'
    providerId: { type: String }, // معرّف المستخدم لدى المزوّد
    avatar: { type: String },
    githubToken: { type: String }, // GitHub access token مشفّر (AES-256-GCM) — للوصول للملفات
    githubLogin: { type: String }, // اسم مستخدم GitHub المرتبط
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
