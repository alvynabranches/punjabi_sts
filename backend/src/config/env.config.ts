import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
    googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleProjectId: process.env.GOOGLE_PROJECT_ID
};