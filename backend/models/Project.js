import mongoose from 'mongoose';

// 🐙 إعدادات تكامل GitHub لكل مشروع (المكافئ لـ GitHubIntegration في مخطط Prisma)
const GitHubIntegrationSchema = new mongoose.Schema({
    patEncrypted: { type: String, default: '' },   // PAT مشفر عبر secretVault — لا يُخزن خاماً أبداً
    repoUrl: { type: String, default: '' },
    branch: { type: String, default: 'main' },
    autoCommit: { type: Boolean, default: true },
    lastCommit: { type: Date, default: null },
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true, lowercase: true, trim: true },
    owner: { type: String, required: true }, // يربط بالمستخدم الحالي
    localPath: { type: String, required: true },
    github: { type: GitHubIntegrationSchema, default: null },
    vercelUrl: { type: String, default: '' }, // الرابط العالمي المنتج من Vercel
    vercelDeploymentId: { type: String, default: '' }, // تتبع حالة النشر السحابي
    framework: { type: String, default: 'HTML5 / Multi-File Suite' },
    health: { type: Number, default: 100 },
    updatedAt: { type: Date, default: Date.now }
});

// تأمين عدم تكرار اسم المشروع لنفس المستخدم
ProjectSchema.index({ name: 1, owner: 1 }, { unique: true });

export default mongoose.model('Project', ProjectSchema);
