import mongoose from 'mongoose';

// 💳 اشتراك المستخدم — يُحدَّث من webhook الخاص بـ Stripe
const SubscriptionSchema = new mongoose.Schema({
    plan: { type: String, default: 'free' },                 // free | pro | enterprise
    status: { type: String, default: 'none' },               // none | active | trialing | past_due | canceled
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
}, { _id: false });

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String }, // bcrypt hash — اختياري لحسابات OAuth
    provider: { type: String, default: 'local' }, // 'local' | 'github' | 'google'
    providerId: { type: String }, // معرّف المستخدم لدى المزوّد
    avatar: { type: String },
    githubToken: { type: String }, // GitHub access token مشفّر (AES-256-GCM) — للوصول للملفات
    githubLogin: { type: String }, // اسم مستخدم GitHub المرتبط
    subscription: { type: SubscriptionSchema, default: () => ({}) }, // 💳 اشتراك Stripe
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
