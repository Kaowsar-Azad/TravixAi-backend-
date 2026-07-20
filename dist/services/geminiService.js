import { GoogleGenerativeAI } from "@google/generative-ai";
class GeminiService {
    apiKeys;
    currentKeyIndex;
    instances;
    constructor() {
        // Read the comma-separated API keys from the environment
        const keysString = process.env.GEMINI_API_KEYS || "";
        this.apiKeys = keysString.split(",").map((k) => k.trim()).filter((k) => k.length > 0);
        if (this.apiKeys.length === 0) {
            console.warn("⚠️ No GEMINI_API_KEYS provided in environment variables!");
        }
        this.currentKeyIndex = 0;
        // Create an instance for each key so we can easily swap them
        this.instances = this.apiKeys.map((key) => new GoogleGenerativeAI(key));
    }
    /**
     * Internal function to attempt generating content with the current key.
     * If a 429 quota error occurs, it switches to the next key and retries.
     */
    async generateContentWithFallback(modelName, prompt, systemInstruction, attempts = 0) {
        if (this.instances.length === 0) {
            throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEYS to .env");
        }
        if (attempts >= this.instances.length) {
            throw new Error("All Gemini API keys have exhausted their quota or failed.");
        }
        const ai = this.instances[this.currentKeyIndex];
        // We use gemini-1.5-flash as default, but allow passing model name
        const model = ai.getGenerativeModel({
            model: modelName,
            systemInstruction,
        });
        try {
            console.log(`[GeminiService] Attempting with API Key index: ${this.currentKeyIndex} (Model: ${modelName})`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error(`[GeminiService] Error with API Key index ${this.currentKeyIndex}:`, error.message);
            const isRetryableError = error.status === 429 ||
                error.status === 503 ||
                error.status === 500 ||
                error.message?.includes("429") ||
                error.message?.includes("503") ||
                error.message?.includes("500") ||
                error.message?.toLowerCase().includes("quota") ||
                error.message?.toLowerCase().includes("limit") ||
                error.message?.toLowerCase().includes("service unavailable") ||
                error.message?.toLowerCase().includes("high demand") ||
                error.message?.toLowerCase().includes("overloaded") ||
                error.message?.toLowerCase().includes("temporary");
            if (isRetryableError) {
                console.warn(`[GeminiService] API Key at index ${this.currentKeyIndex} failed or exhausted. Switching to next key...`);
                this.currentKeyIndex = (this.currentKeyIndex + 1) % this.instances.length;
                // Wait a small delay before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
                // Retry with the next key
                return this.generateContentWithFallback(modelName, prompt, systemInstruction, attempts + 1);
            }
            else {
                // If it's a different error (e.g. invalid request), throw it immediately
                throw error;
            }
        }
    }
    /**
     * Public method to generate a customized travel itinerary
     */
    async customizePlan(basePlanStr, userPreferences) {
        const prompt = `
You are a professional travel planner API. I will provide you with a base travel plan and a user's custom preferences.
Your task is to modify the base travel plan according to the preferences and output a highly detailed, personalized travel itinerary in MARKDOWN format.

### Base Plan Information:
${basePlanStr}

### User's Custom Preferences:
${userPreferences}

### Instructions:
1. Adjust the duration, days, and itinerary activities to strictly match the user's preferences.
2. If the user wants a cheaper budget, suggest budget-friendly accommodations and transport.
3. Output ONLY the new plan. Do not include any conversational filler.
4. Format the output clearly using Markdown headers (e.g., # Trip Title, ## Day 1: [Activity], etc.).
5. DO NOT provide any total cost estimate or budget information in the text output, as the budget is already displayed on the main card UI.
`;
        // We strictly use gemini-2.5-flash for the fastest & most cost-effective results on free tier
        return this.generateContentWithFallback("gemini-2.5-flash", prompt);
    }
    /**
     * Public method for the AI Agent Chat
     */
    async chatWithAgent(chatHistory, userMessage, file, attempts = 0) {
        if (!this.instances || this.instances.length === 0) {
            throw new Error("No Gemini API keys configured. Please add GEMINI_API_KEYS to .env");
        }
        if (attempts >= this.instances.length) {
            throw new Error("All Gemini API keys have exhausted their quota, are overloaded, or failed.");
        }
        const ai = this.instances[this.currentKeyIndex];
        const systemInstruction = "You are Travix AI, a helpful, intelligent, and general-purpose AI assistant for a platform called Travix AI. While you specialize in travel planning, finding destinations, and giving travel advice, you are fully capable of answering any general knowledge questions, analyzing documents, and assisting with a wide variety of tasks like ChatGPT or Gemini. Be concise, polite, and use formatting where appropriate.";
        const model = ai.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction,
        });
        try {
            // Create a chat session with history
            const formattedHistory = chatHistory.map(msg => ({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
            }));
            console.log(`[GeminiService] Chat Attempting with API Key index: ${this.currentKeyIndex}`);
            const chatSession = model.startChat({
                history: formattedHistory,
            });
            let messageParts = userMessage;
            if (file) {
                messageParts = [
                    { text: userMessage },
                    { inlineData: { mimeType: file.mimeType, data: file.data } }
                ];
            }
            const result = await chatSession.sendMessage(messageParts);
            const response = await result.response;
            return response.text();
        }
        catch (error) {
            console.error(`[GeminiService] Chat Error with API Key index ${this.currentKeyIndex}:`, error.message);
            const isRetryableError = error.status === 429 ||
                error.status === 503 ||
                error.status === 500 ||
                error.message?.includes("429") ||
                error.message?.includes("503") ||
                error.message?.includes("500") ||
                error.message?.toLowerCase().includes("quota") ||
                error.message?.toLowerCase().includes("limit") ||
                error.message?.toLowerCase().includes("service unavailable") ||
                error.message?.toLowerCase().includes("high demand") ||
                error.message?.toLowerCase().includes("overloaded") ||
                error.message?.toLowerCase().includes("temporary");
            if (isRetryableError) {
                console.warn(`[GeminiService] API Key at index ${this.currentKeyIndex} failed or overloaded. Switching to next key...`);
                this.currentKeyIndex = (this.currentKeyIndex + 1) % this.instances.length;
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.chatWithAgent(chatHistory, userMessage, file, attempts + 1);
            }
            else {
                throw error;
            }
        }
    }
}
// Export a singleton instance
export const geminiService = new GeminiService();
