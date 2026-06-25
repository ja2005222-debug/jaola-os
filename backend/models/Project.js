import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    name: { type: String, required: true, lowercase: true, trim: true },
    owner: { type: String, required: true }, // يربط بالمستخدم الحالي
    localPath: { type: String, required: true },
    vercelUrl: { type: String, default: '' }, // الرابط العالمي المنتج من Vercel
    vercelDeploymentId: { type: String, default: '' }, // تتبع حالة النشر السحابي
    framework: { type: String, default: 'HTML5 / Multi-File Suite' },
    health: { type: Number, default: 100 },
    updatedAt: { type: Date, default: Date.now }
});

// تأمين عدم تكرار اسم المشروع لنفس المستخدم
ProjectSchema.index({ name: 1, owner: 1 }, { unique: true });

export default mongoose.model('Project', ProjectSchema);
