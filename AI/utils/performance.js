/**
 * Performance Utilities - أدوات تحسين الأداء
 * Debounce, Throttle, Lazy Loading, Caching
 */

/**
 * Debounce - تأخير تنفيذ الدالة إلى أن يتوقف المستخدم
 * مفيد للـ search, resize, input events
 * @param {Function} fn - الدالة المراد تأخيرها
 * @param {number} delay - التأخير بالميلي ثانية
 * @returns {Function} الدالة المُعدّلة
 */
export function debounce(fn, delay) {
    if (typeof fn !== 'function') {
        throw new Error('First argument must be a function');
    }
    if (typeof delay !== 'number' || delay < 0) {
        throw new Error('Delay must be a positive number');
    }

    let timeoutId = null;

    return function debounced(...args) {
        // إلغاء التنفيذ السابق
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }

        // جدولة التنفيذ الجديد
        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Throttle - تحديد تكرار تنفيذ الدالة
 * مفيد للـ scroll, mousemove events
 * @param {Function} fn - الدالة
 * @param {number} interval - الفترة الزمنية بالميلي ثانية
 * @returns {Function} الدالة المُعدّلة
 */
export function throttle(fn, interval) {
    if (typeof fn !== 'function') {
        throw new Error('First argument must be a function');
    }
    if (typeof interval !== 'number' || interval < 0) {
        throw new Error('Interval must be a positive number');
    }

    let lastRun = 0;
    let timeoutId = null;

    return function throttled(...args) {
        const now = Date.now();
        const timeSinceLastRun = now - lastRun;

        if (timeSinceLastRun >= interval) {
            // تنفيذ فوراً
            fn.apply(this, args);
            lastRun = now;
        } else {
            // جدولة التنفيذ في نهاية الفترة
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                fn.apply(this, args);
                lastRun = Date.now();
                timeoutId = null;
            }, interval - timeSinceLastRun);
        }
    };
}

/**
 * Cache - تخزين مؤقت للبيانات
 */
export class Cache {
    constructor(ttl = 60000) { // 60 ثانية افتراضياً
        this.store = new Map();
        this.ttl = ttl;
    }

    /**
     * حفظ قيمة في الـ cache
     */
    set(key, value, customTTL = null) {
        const expiresAt = Date.now() + (customTTL || this.ttl);
        this.store.set(key, { value, expiresAt });
    }

    /**
     * استرجاع قيمة من الـ cache
     */
    get(key) {
        const item = this.store.get(key);
        if (!item) return null;

        // التحقق من انتهاء الصلاحية
        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return item.value;
    }

    /**
     * حذف من الـ cache
     */
    delete(key) {
        this.store.delete(key);
    }

    /**
     * تنظيف الـ cache
     */
    clear() {
        this.store.clear();
    }

    /**
     * تنظيف العناصر المنتهية الصلاحية
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now > item.expiresAt) {
                this.store.delete(key);
            }
        }
    }

    /**
     * الحصول على إحصائيات الـ cache
     */
    stats() {
        return {
            size: this.store.size,
            items: Array.from(this.store.keys())
        };
    }
}

/**
 * Memoize - تخزين نتائج الدوال
 */
export function memoize(fn, options = {}) {
    const cache = new Cache(options.ttl || 300000); // 5 دقائق افتراضياً
    const maxSize = options.maxSize || 100;

    return function memoized(...args) {
        const key = JSON.stringify(args);
        const cached = cache.get(key);

        if (cached !== null) {
            return cached;
        }

        const result = fn.apply(this, args);

        // منع امتلاء الـ cache
        if (cache.store.size >= maxSize) {
            const firstKey = cache.store.keys().next().value;
            cache.delete(firstKey);
        }

        cache.set(key, result);
        return result;
    };
}

/**
 * Lazy Loading - تحميل ديناميكي للمكتبات
 */
export function lazyLoad(modulePath) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = modulePath;
        script.async = true;
        script.onload = () => resolve(script);
        script.onerror = () => reject(new Error(`Failed to load: ${modulePath}`));
        document.head.appendChild(script);
    });
}

/**
 * Intersection Observer - تحميل الصور عند الظهور
 */
export function observeElements(selector, callback, options = {}) {
    if (!('IntersectionObserver' in window)) {
        console.warn('IntersectionObserver not supported');
        return null;
    }

    const defaultOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.01,
        ...options
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                callback(entry.target);
            }
        });
    }, defaultOptions);

    document.querySelectorAll(selector).forEach(el => {
        observer.observe(el);
    });

    return observer;
}

/**
 * قياس الأداء
 */
export class PerformanceMonitor {
    constructor(name = 'Performance') {
        this.name = name;
        this.marks = new Map();
        this.measures = new Map();
    }

    /**
     * بدء قياس
     */
    start(label) {
        performance.mark(`${this.name}-${label}-start`);
    }

    /**
     * إنهاء القياس
     */
    end(label) {
        performance.mark(`${this.name}-${label}-end`);
        performance.measure(
            `${this.name}-${label}`,
            `${this.name}-${label}-start`,
            `${this.name}-${label}-end`
        );
        const measure = performance.getEntriesByName(`${this.name}-${label}`)[0];
        console.log(`⏱️  ${label}: ${measure.duration.toFixed(2)}ms`);
        return measure.duration;
    }

    /**
     * جلب جميع الـ metrics
     */
    getMetrics() {
        const navigation = performance.getEntriesByType('navigation')[0];
        return {
            dns: (navigation.domainLookupEnd - navigation.domainLookupStart).toFixed(2),
            tcp: (navigation.connectEnd - navigation.connectStart).toFixed(2),
            ttfb: (navigation.responseStart - navigation.requestStart).toFixed(2),
            domContent: (navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart).toFixed(2),
            load: (navigation.loadEventEnd - navigation.loadEventStart).toFixed(2)
        };
    }

    /**
     * طباعة تقرير الأداء
     */
    report() {
        const metrics = this.getMetrics();
        console.table({
            'DNS Lookup': `${metrics.dns}ms`,
            'TCP Connection': `${metrics.tcp}ms`,
            'TTFB (Time to First Byte)': `${metrics.ttfb}ms`,
            'DOM Content Loaded': `${metrics.domContent}ms`,
            'Page Load': `${metrics.load}ms`
        });
    }
}

export default {
    debounce,
    throttle,
    Cache,
    memoize,
    lazyLoad,
    observeElements,
    PerformanceMonitor
};
