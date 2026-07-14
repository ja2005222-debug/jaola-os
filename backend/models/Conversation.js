import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  at: { type: Number, default: Date.now }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  messages: [messageSchema],
  // 🧠 ذاكرة طويلة المدى: ملخّص متدحرج يطوي كل ما خرج من نافذة السياق —
  // يبقي الموضوع حاضراً مهما طالت المحادثة (لا يُفقد السياق بعد فترة).
  summary: { type: String, default: '' },
  // عدد الرسائل من البداية التي انطوت بالفعل داخل الملخص
  summarizedCount: { type: Number, default: 0 }
}, { timestamps: true });

conversationSchema.index({ username: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
