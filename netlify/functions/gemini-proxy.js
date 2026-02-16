export const handler = async (event) => {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

    try {
        const payload = JSON.parse(event.body); // Receive the full payload from script.js
        const API_KEY = process.env.GEMINI_API_KEY; 
        
        // We use the model specified in the payload or default to 1.5-flash
        const model = "gemini-2.5-flash"; 
        const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        const response = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) // Pass the payload (with schema) to Google
        });

        const data = await response.json();
        return { statusCode: 200, body: JSON.stringify(data) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};