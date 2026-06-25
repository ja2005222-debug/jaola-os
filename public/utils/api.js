export class APIClient {
    constructor(token) {
        this.token = token;
        this.headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    async request(endpoint, options = {}) {
        const res = await fetch(endpoint, {
            ...options,
            headers: { ...this.headers, ...options.headers }
        });
        if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/user.html';
            throw new Error('Unauthorized');
        }
        if (!res.ok) {
            const error = await res.text();
            throw new Error(error || `API Error: ${res.status}`);
        }
        return res.json();
    }

    get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); }
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); }
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
}

export function initializeAPIClient(token) {
    return new APIClient(token);
}
