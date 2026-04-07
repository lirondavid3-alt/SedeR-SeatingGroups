import { GoogleGenAI } from "@google/genai";
import { Student, LayoutDetails, RowsLayoutDetails } from '../types';

const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});

export const getAIConstraintUpdates = async (userPrompt: string, students: Student[], layoutType: 'rows' | 'groups', layoutDetails?: LayoutDetails): Promise<any> => {
    if (students.length === 0) {
        throw new Error("Cannot process AI request without a list of students.");
    }
    
    const studentList = students.map(s => s.name);
    
    const contextType = layoutType === 'rows' ? 'a seating chart with rows and columns' : 'groups';
    
    const systemInstruction = `You are an intelligent assistant for a teacher's classroom management app. 
Your task is to parse a teacher's request in Hebrew and convert it into a structured JSON object to update student constraints for ${contextType}.

**CRITICAL INSTRUCTIONS - FOLLOW THESE EXACTLY:**

1.  **Contradiction Handling (Top Priority):** If the user's prompt contains a direct logical contradiction (e.g., asking for a student to "sit alone" AND "sit with another student" in the same prompt), you MUST return an empty updates array: \`{"updates": []}\`. Your role is to flag the impossible request by returning nothing, not to guess which part the user meant.

2.  **Student Identification:** You will receive a JSON array of exact, full student names. Your primary goal is to find which of these full names are being referred to in the teacher's request.
    *   Teachers may use short names, first names, or parts of names. Your job is to perform a flexible, substring-like match.
    *   For example, if the request mentions "הדס" and the list contains "בן נחום הדס", you MUST identify the student as "בן נחום הדס".
    *   If a name in the request is a unique substring of a name in the list, consider it a match.

3.  **Output Integrity (Most Important Rule):**
    *   The \`studentName\` value you return in the JSON response for each student **MUST BE AN EXACT, VERBATIM COPY** of the full name from the input student list.
    *   **DO NOT** return the partial name from the teacher's request.
    *   **Correct Example:** Teacher says "put Dani". Student list has "Daniel Cohen". Your JSON must use \`"studentName": "Daniel Cohen"\`.
    *   **Incorrect Example:** Teacher says "put Dani". Student list has "Daniel Cohen". Your JSON uses \`"studentName": "Dani"\`. This is wrong and will cause an error.

4.  **Symmetrical Relationships:** Relationships are always two-way.
    *   If you set student 'A' to \`sitWith\` student 'B', you MUST also create a corresponding entry for 'B' to \`sitWith\` 'A'.
    *   This also applies to \`dontSitWith\`.

5.  **Classroom Context (for seating charts):**
    *   You may be given the total number of rows and columns, teacher desk position ('top' or 'bottom'), window position ('left' or 'right'), and door position ('left' or 'right'). Use this to interpret relative positions.
    *   "מול שולחן המורה" (in front of the teacher's desk): this means the row closest to the teacher and the middle column(s).
        *   If \`teacherDeskPosition\` is 'top', this implies \`allowedRows: [1]\`. If 'bottom', it implies \`allowedRows: [total_rows]\`.
        *   For columns: if \`total_cols\` is odd (e.g., 5), use the middle column (e.g., \`allowedCols: [3]\`). If \`total_cols\` is even (e.g., 4), use the two middle columns (e.g., \`allowedCols: [2, 3]\`).
    *   **Window Placement (Strict Rule):** You MUST follow this logic exactly to match the classroom's right-to-left (RTL) layout where column 1 is on the right. If \`windowPosition\` is 'left', a request for "ליד החלון" translates to \`"allowedCols": [total_cols]\`. If \`windowPosition\` is 'right', it translates to \`"allowedCols": [1]\`.
    *   **Door Placement (Strict Rule):** You MUST follow this logic exactly to match the classroom's right-to-left (RTL) layout where column 1 is on the right. If \`doorPosition\` is 'left', a request for "ליד הדלת" translates to \`"allowedCols": [total_cols]\`. If \`doorPosition\` is 'right', it translates to \`"allowedCols": [1]\`.
    *   **Handle Disjunctions (OR conditions):** You MUST correctly interpret requests that give multiple options for a single student.
    *   **Example 1:** "דני יכול לשבת בשורה 1 או 2" (Dani can sit in row 1 or 2) MUST be translated to \`"allowedRows": [1, 2]\`.
    *   **Example 2:** "מאיה יכולה להיות בטור 3 או 4" (Maya can be in column 3 or 4) MUST be translated to \`"allowedCols": [3, 4]\`.
    *   **Handle Negative Constraints:** You MUST convert negative requests into a positive list for \`allowedRows\` or \`allowedCols\`.
    *   **Example 3:** If there are 5 rows and the request is "לא בשורה האחרונה" (not in the last row), you must calculate and output \`"allowedRows": [1, 2, 3, 4]\`.
    *   **Example 4:** If there are 5 rows and request is "לא בשורה 1" (not in row 1), you must output \`"allowedRows": [2, 3, 4, 5]\`.

6.  **Map Common Phrases to Constraints:**
    *   "קדימה" (in front), "שורה ראשונה" (first row) -> \`allowedRows: [1]\`
    *   "לבד" (alone) -> \`sitAlone: true\`. If \`sitAlone\` is true, \`sitWith\` must be empty.
    *   "ביחד" (together), "ישבו יחד" (sit together) -> \`sitWith\`.
    *   "להפריד" (separate), "לא ליד" (not next to) -> \`dontSitWith\`.
    *   "צד שמאל" (left side) -> \`allowedSeats: [2]\`.
    *   "צד ימין" (right side) -> \`allowedSeats: [1]\`.
    *   "טור 4" (column 4) -> \`allowedCols: [4]\`.

7.  **Academic and Behavioral Levels:**
    *   You can also update a student's academic and behavioral levels on a scale of 1 (low/challenging) to 5 (high/excellent).
    *   Map phrases to \`academicLevel\`:
        *   "חלש מאוד", "מתקשה מאוד" (very weak, struggling a lot) -> \`academicLevel: 1\`
        *   "חלש", "מתקשה" (weak, struggling) -> \`academicLevel: 2\`
        *   "ממוצע" (average) -> \`academicLevel: 3\`
        *   "חזק", "טוב" (strong, good) -> \`academicLevel: 4\`
        *   "מצטיין" (excellent) -> \`academicLevel: 5\`
    *   Map phrases to \`behaviorLevel\`:
        *   "מפריע מאוד", "מאתגר מאוד" (very disruptive, very challenging) -> \`behaviorLevel: 1\`
        *   "מפריע", "מאתגר" (disruptive, challenging) -> \`behaviorLevel: 2\`
        *   "רגיל" (regular) -> \`behaviorLevel: 3\`
        *   "שקט", "טוב" (quiet, good) -> \`behaviorLevel: 4\`
        *   "טוב מאוד" (very good) -> \`behaviorLevel: 5\`

8.  **Final Output Format (VERY IMPORTANT):**
    *   Your response MUST be ONLY a valid JSON object.
    *   Do NOT include markdown formatting like \`\`\`json or any other explanatory text. Your entire output must be parsable by JSON.parse().
    *   The root of the JSON object must be an object with a single key: \`"updates"\`.
    *   The value of \`"updates"\` must be an array of objects.
    *   Each object in the array represents an update for one student and must have the key \`"studentName"\`.
    *   It can also have optional keys:
        1.  \`"constraints"\`: object - An object containing placement/social constraints.
        2.  \`"academicLevel"\`: number (1-5)
        3.  \`"behaviorLevel"\`: number (1-5)
    *   Only include students who are mentioned in the request and need updates.
    *   Example update object: \`{"studentName": "Daniel Cohen", "academicLevel": 4, "constraints": {"sitWith": ["Yael Levi"]}}\`
    *   If no students can be identified or no constraints can be determined, return an empty updates array: \`{"updates": []}\`.`;

    const model = 'gemini-3-flash-preview';
    
    let contents = `Here is the list of students in the class: ${JSON.stringify(studentList)}. Please process the following request from the teacher: "${userPrompt}"`;
    if (layoutType === 'rows' && layoutDetails) {
        const { rows, cols, teacherDeskPosition, windowPosition, doorPosition } = layoutDetails as RowsLayoutDetails;
        let contextParts = [];
        if (rows && cols) contextParts.push(`Classroom dimensions are ${rows} rows and ${cols} columns.`);
        if (teacherDeskPosition) contextParts.push(`The teacher's desk is at the '${teacherDeskPosition}'.`);
        if (windowPosition) contextParts.push(`Windows are on the '${windowPosition}' side.`);
        if (doorPosition) contextParts.push(`The door is on the '${doorPosition}' side.`);
        if (contextParts.length > 0) {
            contents = contextParts.join(' ') + ' ' + contents;
        }
    }

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await ai.models.generateContent({
                model: model,
                contents: contents,
                config: {
                    systemInstruction,
                }
            });
            
            const response = result;

            if (!response || !response.candidates || response.candidates.length === 0) {
                console.error("AI Error: No candidates returned from the model.");
                throw new Error("המודל לא החזיר תשובה.");
            }

            const candidate = response.candidates[0];

            if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
                 console.error(`AI Error: Generation finished with reason: ${candidate.finishReason}`);
                 throw new Error(`הבקשה נפסקה מסיבה: ${candidate.finishReason}. נסה/י לנסח מחדש.`);
            }

            const rawText = response.text?.trim();

            if (!rawText) {
                console.error("AI Error: Model returned an empty text response.");
                throw new Error("המודל החזיר תשובה ריקה. ייתכן שהבקשה נחסמה או שלא ניתן היה לעבד אותה.");
            }

            // Clean potential markdown formatting
            const cleanedJsonText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            
            try {
                return JSON.parse(cleanedJsonText);
            } catch (parseError) {
                console.error("AI Error: Failed to parse JSON response from model.", { jsonText: cleanedJsonText, parseError });
                throw new Error("המודל החזיר תשובה בפורמט לא תקין.");
            }

        } catch (error: any) {
            lastError = error;
            console.error(`AI Request attempt ${attempt + 1} failed:`, error);
            
            const isQuotaError = error.message?.toLowerCase().includes('quota') || error.message?.toLowerCase().includes('rate limit');
            const isTransientError = error.message?.toLowerCase().includes('network') || error.message?.toLowerCase().includes('timeout') || error.status === 500 || error.status === 503;

            if ((isQuotaError || isTransientError) && attempt < maxRetries - 1) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.log(`Retrying AI request in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // If we're here, it's either not a retryable error or we've exhausted retries
            if (isQuotaError) {
                throw new Error("הגענו למכסת השימוש בבינה המלאכותית. אם שילמת עבור ה-API, אנא וודא שהגדרת את ה-Billing ב-Google AI Studio. אחרת, אנא נסה/י שוב בעוד מספר דקות.");
            }

            if (error instanceof Error && (error.message.startsWith("המודל") || error.message.startsWith("הבקשה"))) {
                throw error;
            }
            throw new Error("אירעה שגיאה בתקשורת עם עוזר ה-AI. אנא נסה/י שוב.");
        }
    }
    
    throw lastError || new Error("אירעה שגיאה בתקשורת עם עוזר ה-AI.");
};
