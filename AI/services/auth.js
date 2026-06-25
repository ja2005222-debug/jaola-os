/**
 * Authentication Service - خدمة المصادقة
 * معالجة تسجيل الدخول والخروج والجلسات
 */

import { APIClient } from '../utils/api.js';
import { validateEmail, validatePasswordStrength } from '../utils/security.js';

/**
 * تسجيل مستخدم جديد
 * @param {string} username - اسم المستخدم
 * @param {string} email - البريد الإلكتروني
 * @param {string} password - كلمة المرور
 * @returns {Promise<Object>} بيانات التسجيل
 */
export async function register(username, email, password) {
    // التحقق من صحة البيانات
    validateEmail(email);
    
    const passwordCheck = validatePasswordStrength(password);
    if (passwordCheck.score < 2) {
        throw new Error(`Password too weak: ${passwordCheck.feedback.join(', ')}`);
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Registration failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

/**
 * تسجيل الدخول
 * @param {string} username - اسم المستخدم
 * @param {string} password - كلمة المرور
 * @returns {Promise<Object>} {token, user}
 */
export async function login(username, password) {
    if (!username || !password) {
        throw new Error('Username and password are required');
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Login failed');
        }

        const data = await response.json();
        
        if (data.token) {
            // حفظ التوكن في sessionStorage (أكثر أماناً من localStorage)
            sessionStorage.setItem('token', data.token);
            
            // حفظ معلومات المستخدم
            if (data.user) {
                sessionStorage.setItem('user', JSON.stringify(data.user));
            }
        }

        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * تسجيل الخروج
 */
export function logout() {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/user.html';
}

/**
 * الحصول على التوكن الحالي
 * @returns {string|null}
 */
export function getToken() {
    return sessionStorage.getItem('token') || localStorage.getItem('token');
}

/**
 * الحصول على بيانات المستخدم الحالي
 * @returns {Object|null}
 */
export function getCurrentUser() {
    const userStr = sessionStorage.getItem('user');
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

/**
 * التحقق من صحة الجلسة
 * @param {APIClient} api - عميل الـ API
 * @returns {Promise<boolean>}
 */
export async function verifySession(api) {
    try {
        const user = await api.get('/user/profile');
        return !!user;
    } catch (error) {
        console.error('Session verification failed:', error);
        return false;
    }
}

/**
 * تحديث بيانات المستخدم
 * @param {APIClient} api - عميل الـ API
 * @param {Object} updates - البيانات المراد تحديثها
 * @returns {Promise<Object>}
 */
export async function updateUserProfile(api, updates) {
    try {
        const user = await api.put('/user/profile', updates);
        sessionStorage.setItem('user', JSON.stringify(user));
        return user;
    } catch (error) {
        console.error('Profile update failed:', error);
        throw error;
    }
}

/**
 * تغيير كلمة المرور
 * @param {APIClient} api
 * @param {string} oldPassword
 * @param {string} newPassword
 * @returns {Promise<boolean>}
 */
export async function changePassword(api, oldPassword, newPassword) {
    const passwordCheck = validatePasswordStrength(newPassword);
    if (passwordCheck.score < 2) {
        throw new Error(`New password too weak: ${passwordCheck.feedback.join(', ')}`);
    }

    try {
        await api.post('/user/change-password', {
            oldPassword,
            newPassword
        });
        return true;
    } catch (error) {
        console.error('Password change failed:', error);
        throw error;
    }
}

/**
 * OAuth - تسجيل دخول عبر Google
 * @returns {void}
 */
export function loginWithGoogle() {
    window.location.href = '/api/auth/google';
}

/**
 * OAuth - تسجيل دخول عبر GitHub
 * @returns {void}
 */
export function loginWithGithub() {
    window.location.href = '/api/auth/github';
}

export default {
    register,
    login,
    logout,
    getToken,
    getCurrentUser,
    verifySession,
    updateUserProfile,
    changePassword,
    loginWithGoogle,
    loginWithGithub
};
