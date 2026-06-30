import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String }, // bcrypt hash — اختياري لحسابات OAuth المستقبلية
    provider: { type: String, default: 'local' }, // 'local' | 'github' | 'google'
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
