import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    provider: { type: String, default: 'GitHub' },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
