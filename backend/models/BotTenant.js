import mongoose from 'mongoose';

// 🤖 مستأجر مستقلّ لجولا بوت (JAOLA_BOT_PRODUCT_ROADMAP.md § 2.2): عميل من خارج
// jaola يلصق سطر تضمين واحد في موقعه الخاص — بلا مشروع jaola ولا توكن موقّع.
// كل معرّف (tenantId) إعداده مستقلّ تماماً عن غيره.
const FaqSchema = new mongoose.Schema({ q: String, a: String }, { _id: false });

const BotTenantSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, unique: true, index: true },
    ownerUsername: { type: String, required: true, index: true }, // حساب jaola المالك للوحة التحكّم
    brandName: { type: String, default: 'مساعدك' },
    emoji: { type: String, default: '🤖' },
    color: { type: String, default: '#3b82f6' },
    welcome: { type: String, default: '' },
    faq: { type: [FaqSchema], default: [] },
    quick: { type: [String], default: [] },
    apiEnabled: { type: Boolean, default: true }, // ذكاء حيّ أم قاعدة أسئلة ثابتة فقط
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('BotTenant', BotTenantSchema);
