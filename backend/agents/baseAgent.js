import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import OpenAI from 'openai';

export const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY,
});
dotenv.config();

export const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
export const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

if (groq) console.log('⚡ [AI Core - baseAgent]: محرك Groq نشط كخيار أول فائق السرعة.');
if (ai) console.log('♊ [AI Core - baseAgent]: محرك Gemini نشط كخطة بديلة لحالات الضغط.');
