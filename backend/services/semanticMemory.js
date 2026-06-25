import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddings } from '@langchain/openai';
import dotenv from 'dotenv';
dotenv.config();

const client = new ChromaClient({ path: "http://localhost:8000" }); // أو استخدم Chroma المحلي
let collection = null;

async function initCollection() {
    try {
        collection = await client.getOrCreateCollection({ name: "jaola_memory" });
    } catch(e) {
        console.warn("Chroma not available, using fallback memory.");
        collection = null;
    }
}

export async function storeFix(error, fix) {
    if (!collection) return;
    await collection.add({
        ids: [Date.now().toString()],
        metadatas: [{ error: error.substring(0, 500), fix: JSON.stringify(fix) }],
        documents: [error]
    });
}

export async function recallFix(error) {
    if (!collection) return null;
    const results = await collection.query({ queryTexts: [error], nResults: 1 });
    if (results.documents[0]?.length) {
        try {
            return JSON.parse(results.metadatas[0][0].fix);
        } catch(e) { return null; }
    }
    return null;
}

initCollection();
