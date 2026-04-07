import { GoogleGenAI, Type } from "@google/genai";

export interface ExtractedStudent {
    name: string;
    gender: 'זכר' | 'נקבה' | '';
}

export const extractStudentsFromImage = async (base64Data: string, mimeType: string): Promise<ExtractedStudent[]> => {
    const model = 'gemini-flash-latest';
    const systemInstruction = "You are an expert at extracting student names from images. Return ONLY a valid JSON object with a 'students' array of objects with 'name' and 'gender' (זכר/נקבה). Hebrew names only.";
    
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("מפתח API חסר.");
        }

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
            model: model,
            contents: [
                {
                    parts: [
                        { inlineData: { mimeType: mimeType, data: base64Data } },
                        { text: "Extract student names from this file (image or PDF). Return a JSON object: { \"students\": [ { \"name\": \"...\", \"gender\": \"זכר/נקבה/\" } ] }. Hebrew names only." }
                    ]
                }
            ],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json"
            }
        });

        if (!response || !response.text) {
            throw new Error("לא התקבלה תשובה מהמודל.");
        }

        const rawText = response.text;
        try {
            const parsed = JSON.parse(rawText.trim());
            return parsed.students || [];
        } catch (parseError) {
            console.error("JSON Parse Error:", rawText);
            throw new Error("שגיאה בפענוח נתוני השמות.");
        }
    } catch (error: any) {
        console.error(`Vision AI Error:`, error);
        throw new Error(error.message || "אירעה שגיאה בעיבוד הקובץ.");
    }
};
