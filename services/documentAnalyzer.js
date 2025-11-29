    // services/documentAnalyzer.js
    const openai = require("./openaiClient");


    async function analyzeDocument(documentText, caseName, fileName) {
    const prompt = `You are a legal AI assistant.  Analyze this legal document and provide a structured analysis. 

    Document Name: ${fileName}
    Case: ${caseName}

    Document Content:
    ${documentText. substring(0, 4000)}

    Provide analysis in the following JSON format:
    {
    "documentType": "string (e.g., Contract, Agreement, Notice, Court Filing)",
    "summary": "string (2-3 sentence summary)",
    "keyParties": ["array of key parties/entities mentioned"],
    "keyFindings": ["array of 3-5 most important points"],
    "potentialRisks": ["array of 2-3 risk factors or concerns"],
    "importantDates": ["array of deadlines or key dates mentioned"],
    "recommendations": ["array of 2-3 recommended next actions"]
    }`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
        {
            role: "system",
            content: "You are an expert legal analyst. Provide concise, actionable insights."
        },
        {
            role: "user",
            content: prompt
        }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
    });

    return JSON.parse(response.choices[0].message.content);
    }

    module.exports = { analyzeDocument };