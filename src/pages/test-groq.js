// test-groq.js

import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const chat = await groq.chat.completions.create({
  messages: [
    {
      role: "user",
      content: "hello"
    }
  ],
  model: "llama-3.3-70b-versatile"
});

console.log(chat.choices[0].message.content);
