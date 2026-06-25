/**
 * Security Utilities - أدوات الأمان والتحقق من البيانات
 * منع XSS, CSRF, SQL Injection وغيرها من الثغرات
 */

/**
 * تنظيف النصوص من الأكواس الخطيرة (منع XSS)
 * @param {string} str - النص المراد تنظيفه
 * @returns {string} النص الآمن
 */
export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;'
    };
    
    return str.replace(/[&<>"'\/]/g, char => map[char]);
}

/**
 * تنظيف مسارات الملفات (منع Path Traversal)
 * @param {string} filePath - المسار
 * @returns {boolean} هل المسار آمن
 */
export function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path: must be a non-empty string');
    }

    // منع الـ traversal attacks
    if (filePath.includes('..') || filePath.includes('//')) {
        throw new Error('Invalid file path: contains traversal sequences');
    }

    // منع المسارات المطلقة
    if (filePath.startsWith('/')) {
        throw new Error('Invalid file path: must be relative path');
    }

    // السماح فقط بامتدادات محددة
    const allowedExtensions = [
        '.js', '.ts', '.jsx', '.tsx',
        '.html', '.css', '.scss', '.json',
        '.md', '.yml', '.yaml', '.env',
        '.xml', '.svg', '.png', '.jpg',
        '.gif', '.ico', '.webp'
    ];

    const extension = filePath.split('.').pop();
    if (!allowedExtensions.includes('.' + extension)) {
        throw new Error(`File type .${extension} not allowed`);
    }

    // حد أقصى لطول المسار
    if (filePath.length > 500) {
        throw new Error('File path too long');
    }

    return true;
}

/**
 * التحقق من صحة البريد الإلكتروني
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
    }
    if (email.length > 254) {
        throw new Error('Email too long');
    }
    return true;
}

/**
 * التحقق من قوة كلمة المرور
 * @param {string} password
 * @returns {Object} {score, feedback}
 */
export function validatePasswordStrength(password) {
    if (!password || password.length < 8) {
        return {
            score: 0,
            feedback: 'Password must be at least 8 characters'
        };
    }

    let score = 0;
    const feedback = [];

    // يحتوي على أحرف كبيرة
    if (/[A-Z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Add uppercase letters');
    }

    // يحتوي على أحرف صغيرة
    if (/[a-z]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Add lowercase letters');
    }

    // يحتوي على أرقام
    if (/[0-9]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Add numbers');
    }

    // يحتوي على رموز خاصة
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        score += 1;
    } else {
        feedback.push('Add special characters');
    }

    // طول إضافي
    if (password.length >= 12) {
        score += 1;
    }

    const strengthMap = {
        0: 'Very Weak',
        1: 'Weak',
        2: 'Fair',
        3: 'Good',
        4: 'Strong',
        5: 'Very Strong'
    };

    return {
        score: Math.min(score, 5),
        strength: strengthMap[Math.min(score, 5)],
        feedback: feedback.length > 0 ? feedback : ['Password is strong']
    };
}

/**
 * التحقق من أوامر خطيرة
 * @param {string} instruction
 * @returns {boolean}
 */
export function validateInstruction(instruction) {
    if (!instruction || typeof instruction !== 'string') {
        throw new Error('Invalid instruction');
    }

    if (instruction.length > 5000) {
        throw new Error('Instruction too long (max 5000 characters)');
    }

    // أوامر خطيرة يجب منعها
    const dangerousPatterns = [
        /rm\s+-rf/gi,           // حذف الملفات
        /dd\s+if=/gi,           // استبدال القرص
        /exec\s*\(/gi,          // تنفيذ أوامر
        /system\s*\(/gi,        // استدعاء النظام
        /eval\s*\(/gi,          // تقييم الأكواس
        /process\.exit/gi,      // إيقاف العملية
        /__proto__/gi,          // Prototype pollution
        /require\s*\(/gi,       // استدعاء الملفات (في الـ client)
        /import\s+.*\(/gi,      // استيراد ديناميكي
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(instruction)) {
            throw new Error('Instruction contains dangerous patterns');
        }
    }

    return true;
}

/**
 * التحقق ��ن اسم المستخدم
 * @param {string} username
 * @returns {boolean}
 */
export function validateUsername(username) {
    if (!username || username.length < 3) {
        throw new Error('Username must be at least 3 characters');
    }

    if (username.length > 30) {
        throw new Error('Username must not exceed 30 characters');
    }

    // السماح فقط بـ letters, numbers, underscore, dash
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, underscore, and dash');
    }

    return true;
}

/**
 * تنظيف JSON من الحقول الخطيرة
 * @param {Object} obj - الكائن
 * @param {Array} allowed - الحقول المسموحة
 * @returns {Object}
 */
export function sanitizeJSON(obj, allowed = []) {
    if (!obj || typeof obj !== 'object') return {};

    const sanitized = {};
    for (const key in obj) {
        if (allowed.includes(key)) {
            const value = obj[key];
            // تنظيف القيم النصية
            if (typeof value === 'string') {
                sanitized[key] = escapeHtml(value);
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeJSON(value, allowed);
            } else {
                sanitized[key] = value;
            }
        }
    }
    return sanitized;
}

/**
 * إنشاء CSRF token
 * @returns {string}
 */
export function generateCSRFToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * التحقق من CSRF token
 * @param {string} token
 * @returns {boolean}
 */
export function verifyCSRFToken(token) {
    const stored = sessionStorage.getItem('csrf_token');
    return stored && stored === token;
}

export default {
    escapeHtml,
    validateFilePath,
    validateEmail,
    validatePasswordStrength,
    validateInstruction,
    validateUsername,
    sanitizeJSON,
    generateCSRFToken,
    verifyCSRFToken
};
