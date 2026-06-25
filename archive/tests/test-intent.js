import { reason } from '../agents/reasoning.agent.js';
import fs from 'fs';

const testData = JSON.parse(fs.readFileSync(new URL('./intent-test.json', import.meta.url)));

async function runTests() {
    let passed = 0;
    let failed = 0;
    for (const test of testData) {
        const result = await reason(test.input);
        const isCorrect = (result.intent === test.expected && result.confidence >= test.minConfidence);
        if (isCorrect) {
            console.log(`✅ ${test.input} -> ${result.intent} (${result.confidence})`);
            passed++;
        } else {
            console.log(`❌ ${test.input} -> expected ${test.expected}, got ${result.intent} (${result.confidence})`);
            failed++;
        }
    }
    console.log(`\n📊 Summary: ${passed} passed, ${failed} failed`);
}

runTests();
