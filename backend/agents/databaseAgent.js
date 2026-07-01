/**
 * 🗄️ Database Agent — JAOLA OS
 *
 * يُحدد نوع قاعدة البيانات المناسبة ويُولّد:
 * - Schema كاملة (MongoDB Models أو PostgreSQL Tables)
 * - Seed Data واقعية ومناسبة للمشروع
 * - API Routes تربط الـ Frontend بقاعدة البيانات
 * - Connection setup
 */

import { groq } from './baseAgent.js';

// ═══════════════════════════════════════════════════════
// 🔍 تحديد نوع قاعدة البيانات المناسبة
// ═══════════════════════════════════════════════════════
const POSTGRES_KEYWORDS = [
    'مالي', 'محاسبة', 'فاتورة', 'دفع', 'payment', 'finance',
    'accounting', 'invoice', 'bank', 'بنك', 'عملات', 'currency'
];

export function selectDatabase(userGoal, projectType) {
    const goal = (userGoal || '').toLowerCase();
    const needsPostgres = POSTGRES_KEYWORDS.some(kw => goal.includes(kw));

    if (needsPostgres) return 'postgresql';
    return 'mongodb'; // الافتراضي — أسهل للمبتدئين وأسرع للنماذج الأولية
}

// ═══════════════════════════════════════════════════════
// 📊 Schemas جاهزة لأشهر أنواع المشاريع
// ═══════════════════════════════════════════════════════
const MONGODB_SCHEMAS = {
    ecommerce: `
// models/Product.js
import mongoose from 'mongoose';
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: String,
    image: String,
    stock: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: [{ user: String, comment: String, rating: Number, date: Date }],
}, { timestamps: true });
export default mongoose.model('Product', ProductSchema);

// models/Order.js
const OrderSchema = new mongoose.Schema({
    customer: { name: String, email: String, phone: String, address: String },
    items: [{ productId: String, name: String, price: Number, qty: Number }],
    total: Number,
    status: { type: String, enum: ['pending', 'confirmed', 'shipped', 'delivered'], default: 'pending' },
    paymentMethod: String,
}, { timestamps: true });
export default mongoose.model('Order', OrderSchema);`,

    restaurant: `
// models/MenuItem.js
const MenuItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true },
    category: { type: String, enum: ['مقبلات', 'رئيسية', 'حلويات', 'مشروبات'] },
    image: String,
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
}, { timestamps: true });

// models/Reservation.js
const ReservationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    date: { type: Date, required: true },
    time: String,
    guests: { type: Number, required: true },
    notes: String,
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
}, { timestamps: true });`,

    hotel: `
// models/Room.js
const RoomSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    type: { type: String, enum: ['standard', 'deluxe', 'suite', 'penthouse'] },
    price: { type: Number, required: true },
    capacity: Number,
    amenities: [String],
    images: [String],
    isAvailable: { type: Boolean, default: true },
}, { timestamps: true });

// models/Booking.js
const BookingSchema = new mongoose.Schema({
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    guest: { name: String, email: String, phone: String, nationality: String },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    totalPrice: Number,
    status: { type: String, enum: ['pending', 'confirmed', 'checked-in', 'checked-out'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
}, { timestamps: true });`,

    medical: `
// models/Doctor.js
const DoctorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    bio: String,
    image: String,
    schedule: [{ day: String, from: String, to: String }],
    experience: Number,
    rating: { type: Number, default: 0 },
}, { timestamps: true });

// models/Appointment.js
const AppointmentSchema = new mongoose.Schema({
    patient: { name: String, phone: String, email: String, age: Number },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    date: { type: Date, required: true },
    time: String,
    type: { type: String, enum: ['استشارة', 'متابعة', 'كشف', 'طارئ'] },
    notes: String,
    status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
}, { timestamps: true });`,

    education: `
// models/Course.js
const CourseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    instructor: String,
    price: Number,
    duration: String,
    level: { type: String, enum: ['مبتدئ', 'متوسط', 'متقدم'] },
    image: String,
    students: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    topics: [String],
}, { timestamps: true });

// models/Enrollment.js
const EnrollmentSchema = new mongoose.Schema({
    student: { name: String, email: String, phone: String },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    progress: { type: Number, default: 0 },
}, { timestamps: true });`,
};

// ═══════════════════════════════════════════════════════
// 🌱 Seed Data واقعية
// ═══════════════════════════════════════════════════════
const SEED_DATA = {
    ecommerce: `
// seed/products.js
export const products = [
    { name: "قميص كلاسيكي أبيض", price: 89, category: "ملابس", stock: 50, rating: 4.5, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400" },
    { name: "بنطال جينز أزرق", price: 149, category: "ملابس", stock: 30, rating: 4.2, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400" },
    { name: "حذاء رياضي", price: 250, category: "أحذية", stock: 20, rating: 4.8, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400" },
    { name: "حقيبة جلدية", price: 380, category: "إكسسوارات", stock: 15, rating: 4.6, image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400" },
    { name: "ساعة كلاسيكية", price: 550, category: "إكسسوارات", stock: 10, rating: 4.9, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400" },
    { name: "نظارة شمسية", price: 180, category: "إكسسوارات", stock: 25, rating: 4.3, image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400" },
];`,

    restaurant: `
// seed/menu.js
export const menuItems = [
    { name: "شاورما دجاج", price: 25, category: "رئيسية", rating: 4.8, image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400" },
    { name: "مشاوي مشكلة", price: 85, category: "رئيسية", rating: 4.9, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400" },
    { name: "سلطة فتوش", price: 18, category: "مقبلات", rating: 4.5, image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400" },
    { name: "حمص بالزيت", price: 15, category: "مقبلات", rating: 4.7, image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400" },
    { name: "كنافة نابلسية", price: 22, category: "حلويات", rating: 4.9, image: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400" },
    { name: "عصير طازج", price: 12, category: "مشروبات", rating: 4.6, image: "https://images.unsplash.com/photo-1534353341085-83e69dc5fcbe?w=400" },
];`,

    hotel: `
// seed/rooms.js
export const rooms = [
    { number: "101", type: "standard", price: 250, capacity: 2, amenities: ["WiFi", "تكييف", "تلفزيون", "مينيبار"], image: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400" },
    { number: "201", type: "deluxe", price: 450, capacity: 2, amenities: ["WiFi", "تكييف", "جاكوزي", "إطلالة بحرية", "خدمة غرف"], image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400" },
    { number: "301", type: "suite", price: 850, capacity: 4, amenities: ["WiFi", "جلسة خاصة", "جاكوزي", "مطبخ صغير", "خدمة كونسيرج"], image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400" },
    { number: "PH1", type: "penthouse", price: 2500, capacity: 6, amenities: ["WiFi", "مسبح خاص", "مطبخ كامل", "خادم خاص", "إطلالة بانورامية"], image: "https://images.unsplash.com/photo-1631049552057-403cdb8f0658?w=400" },
];`,
};

// ═══════════════════════════════════════════════════════
// 🚀 الدالة الرئيسية
// ═══════════════════════════════════════════════════════
export async function generateDatabase(userGoal, projectType, projectPath) {
    const dbType = selectDatabase(userGoal, projectType);
    const schema = MONGODB_SCHEMAS[projectType] || await generateDynamicSchema(userGoal, projectType);
    const seedData = SEED_DATA[projectType] || '';

    const files = [];

    // ملف الاتصال بقاعدة البيانات
    files.push({
        name: 'api/db.js',
        content: `
import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/jaola_app');
        isConnected = true;
        console.log('✅ MongoDB متصل');
    } catch (error) {
        console.error('❌ فشل الاتصال:', error.message);
    }
}`.trim()
    });

    // ملف Schema
    if (schema) {
        files.push({
            name: 'api/schema.js',
            content: `import mongoose from 'mongoose';\n${schema}`.trim()
        });
    }

    // ملف Seed Data
    if (seedData) {
        files.push({
            name: 'api/seed.js',
            content: seedData.trim()
        });
    }

    // ملف .env.example
    files.push({
        name: '.env.example',
        content: `MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/jaola_app\nNEXT_PUBLIC_API_URL=http://localhost:3000`
    });

    return {
        success: true,
        dbType,
        files,
        summary: `${dbType} — ${files.length} ملف (schema, seed, connection)`
    };
}

// توليد Schema ديناميكي للأنواع غير المغطاة
async function generateDynamicSchema(userGoal, projectType) {
    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{
                role: 'system',
                content: 'أنت مهندس قواعد بيانات. اكتب MongoDB Schema بـ Mongoose لهذا المشروع. كود فقط بدون شرح.'
            }, {
                role: 'user',
                content: `المشروع: ${userGoal}\nالنوع: ${projectType}\nاكتب Schema مناسباً بـ Mongoose.`
            }],
            max_tokens: 600,
            temperature: 0.2,
        });
        return completion.choices[0].message.content;
    } catch (e) {
        return null;
    }
}
