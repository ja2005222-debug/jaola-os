import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import './helpers/mockProviders.mjs';

test('unconfigured provider fixtures fail before any network transport', async () => {
    const previous = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = async () => { requests++; throw new Error('Unexpected network transport'); };
    try {
        const requestsToMock = [
            () => new OpenAI({ apiKey: 'test-only' }).chat.completions.create({ model: 'test', messages: [] }),
            () => new Groq({ apiKey: 'test-only' }).chat.completions.create({ model: 'test', messages: [] }),
            () => new GoogleGenAI({ apiKey: 'test-only' }).models.generateContent({ model: 'test', contents: 'fixture' }),
        ];
        for (const call of requestsToMock) await assert.rejects(call, /explicit AI provider response fixture/);
        assert.equal(requests, 0);
    } finally {
        globalThis.fetch = previous;
    }
});
