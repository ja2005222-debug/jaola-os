// Test-only SDK transports. Application code is never changed or imported here.
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';

export async function unmockedProviderRequest() {
    const error = new Error('Test requires an explicit AI provider response fixture');
    error.status = 401;
    throw error;
}

OpenAI.prototype.request = unmockedProviderRequest;
Groq.prototype.request = unmockedProviderRequest;
const googleTransport = Object.getPrototypeOf(new GoogleGenAI({ apiKey: 'test-only' }).models.apiClient);
for (const method of ['request', 'requestStream', 'apiCall', 'uploadFile', 'downloadFile']) {
    googleTransport[method] = unmockedProviderRequest;
}
