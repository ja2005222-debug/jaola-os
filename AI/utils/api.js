/**
 * API Client - موحد ومركزي
 * يوفر جميع عمليات الـ API بطريقة آمنة وفعالة
 */

export class APIClient {
    constructor(token, baseUrl = '/api') {
        this.token = token;
        this.baseUrl = baseUrl;
        this.timeout = 30000; // 30 ثانية
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 ثانية
    }

    /**
     * إرسال طلب HTTP عام
     * @param {string} method - GET, POST, PUT, DELETE
     * @param {string} endpoint - المسار (مثل /tasks)
     * @param {Object} body - البيانات المرسلة (للـ POST/PUT)
     * @param {Object} options - خيارات إضافية
     * @returns {Promise<Object>} الرد من الخادم
     */
    async request(method, endpoint, body = null, options = {}) {
        const {
            retry = true,
            timeout = this.timeout,
            headers = {}
        } = options;

        const requestConfig = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...headers
            },
            signal: AbortSignal.timeout(timeout)
        };

        if (body) {
            requestConfig.body = JSON.stringify(body);
        }

        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, requestConfig);

            // معالجة حالات الخطأ الخاصة
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Unauthorized - Session expired');
            }

            if (response.status === 403) {
                throw new Error('Forbidden - You do not have permission');
            }

            if (response.status === 404) {
                throw new Error('Resource not found');
            }

            if (response.status === 500) {
                throw new Error('Server error - Please try again later');
            }

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            // إعادة المحاولة تلقائياً للأخطاء المؤقتة
            if (retry && this.shouldRetry(error)) {
                console.warn(`Request failed, retrying in ${this.retryDelay}ms:`, error.message);
                await this.delay(this.retryDelay);
                return this.request(method, endpoint, body, { ...options, retry: false });
            }

            // تسجيل الخطأ بالتفصيل
            this.logError(method, endpoint, error);
            throw error;
        }
    }

    /**
     * طلب GET
     * @param {string} endpoint
     * @param {Object} options
     */
    get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    /**
     * طلب POST
     * @param {string} endpoint
     * @param {Object} body
     * @param {Object} options
     */
    post(endpoint, body, options = {}) {
        return this.request('POST', endpoint, body, options);
    }

    /**
     * طلب PUT
     * @param {string} endpoint
     * @param {Object} body
     * @param {Object} options
     */
    put(endpoint, body, options = {}) {
        return this.request('PUT', endpoint, body, options);
    }

    patch(endpoint, body, options = {}) {
        return this.request('PATCH', endpoint, body, options);
    }

    /**
     * طلب DELETE
     * @param {string} endpoint
     * @param {Object} options
     */
    delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    /**
     * تحديد ما إذا كان يجب إعادة المحاولة
     */
    shouldRetry(error) {
        // إعادة المحاولة للأخطاء المؤقتة فقط
        const retryableErrors = [
            'NetworkError',
            'TimeoutError',
            'Failed to fetch'
        ];
        return retryableErrors.some(e => error.message.includes(e));
    }

    /**
     * تأخير زمني
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * معالجة عدم التفويض (401)
     */
    handleUnauthorized() {
        sessionStorage.removeItem('token');
        localStorage.removeItem('token');
        window.location.href = '/user.html';
    }

    /**
     * تسجيل الأخطاء
     */
    logError(method, endpoint, error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] API Error [${method} ${endpoint}]:`, {
            message: error.message,
            stack: error.stack
        });

        // إرسال الخطأ لـ error tracking service (مثل Sentry)
        if (window.errorTracker) {
            window.errorTracker.captureException(error, {
                tags: {
                    method,
                    endpoint
                }
            });
        }
    }

    /**
     * إنشاء instance من الـ API Client
     */
    static create(token) {
        if (!token) {
            throw new Error('Token is required for API Client');
        }
        return new APIClient(token);
    }
}

// Export instance للاستخدام المباشر
export function initializeAPIClient(token) {
    const client = APIClient.create(token);
    window.api = client; // متاح في جميع الأماكن
    return client;
}
