export function debounce(fn, delay = 300) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

export function throttle(fn, limit = 1000) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

export class Cache {
    constructor(ttl = 60000) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        this.cache.set(key, { value, expiry: Date.now() + this.ttl });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    clear() { this.cache.clear(); }
}

export class PerformanceMonitor {
    constructor(name) {
        this.name = name;
        this.marks = new Map();
    }

    start(label) { this.marks.set(label, performance.now()); }
    end(label) {
        const start = this.marks.get(label);
        if (start) {
            const duration = performance.now() - start;
            console.log(`[${this.name}] ${label}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return null;
    }
    report() { console.log(`[${this.name}] Performance monitoring active`); }
}
