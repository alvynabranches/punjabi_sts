import { Injectable } from '@nestjs/common';
import { config } from '../config/env.config';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

@Injectable()
export class OpenRouterService {
    private readonly API_KEY = config.openrouterApiKey;
    private readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
    private readonly MODEL = 'qwen/qwen3-235b-a22b:free';

    constructor() { }

    async generateResponse(messages: ChatMessage[]): Promise<string> {
        try {
            const startTime = performance.now();

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'model': this.MODEL,
                    'messages': messages
                })
            });

            const responseBody = await response.json();
            const content = responseBody.choices[0].message.content.replace(/\*\*/g, '').replace(/\#\#/g, '');

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`OpenRouter response time: ${duration} milliseconds`);
            console.log({ inputTokens: responseBody.usage.prompt_tokens, outputTokens: responseBody.usage.completion_tokens, totalTokens: responseBody.usage.total_tokens });

            return content;
        } catch (error) {
            console.error('OpenRouter API error:', error);
            if (error instanceof Error) {
                throw new Error(`OpenRouter API error: ${error.message}`);
            } else {
                throw new Error('An unknown error occurred');
            }
        }
    }
}