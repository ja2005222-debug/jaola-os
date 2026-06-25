import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testConnection() {
    console.log("[Test] Testing connection to Groq API...");
    
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [{ role: 'user', content: 'Say "Hello JAOLA OS, Connection Successful!"' }]
            })
        });

        const data = await response.json();
        
        if (data.choices) {
            console.log("\n[SUCCESS] Response from Groq:");
            console.log("----------------------------");
            console.log(data.choices[0].message.content);
            console.log("----------------------------\n");
        } else {
            console.error("\n[ERROR] Groq API returned an error:", data);
        }
    } catch (error) {
        console.error("\n[CRITICAL] Could not connect to Groq:", error.message);
    }
}

testConnection();
