import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleProjectId: process.env.GOOGLE_PROJECT_ID,
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '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',
    fireworksApiKey: process.env.FIREWORKS_API_KEY || 'fw_3ZRFhcw1ir2r6NkrJjoDUxpB'
};