import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true }
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  username: { type: String, required: true, index: true },
  messages: [messageSchema]
}, { timestamps: true });

conversationSchema.index({ username: 1 }, { unique: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
