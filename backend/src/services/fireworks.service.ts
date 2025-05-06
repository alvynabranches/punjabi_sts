import { Injectable } from '@nestjs/common';
import { config } from '../config/env.config';

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

@Injectable()
export class FireworksService {
    private readonly API_KEY = config.fireworksApiKey;
    private readonly API_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';
    private readonly MODEL = 'accounts/fireworks/models/qwen3-235b-a22b';

    constructor() { }

    async generateResponse(messages: ChatMessage[]): Promise<string> {
        try {
            const startTime = performance.now();

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.API_KEY}`
                },
                body: JSON.stringify({
                    model: this.MODEL,
                    max_tokens: 40960,
                    top_p: 1,
                    top_k: 40,
                    presence_penalty: 0,
                    frequency_penalty: 0,
                    temperature: 0.6,
                    messages: messages
                })
            });

            const responseBody = await response.json();
            const content = responseBody.choices[0].message.content.replace(/<think>.*?<\/think>\n\n/gs, '').replace(/\-\-\-/g, '').replace(/\*\*/g, '').replace(/\#\#/g, '').replace(/\#/g, '');

            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`Fireworks response time: ${duration} milliseconds`);
            console.log({ inputTokens: responseBody.usage.prompt_tokens, outputTokens: responseBody.usage.completion_tokens, totalTokens: responseBody.usage.total_tokens });

            return content;
        } catch (error) {
            console.error('Fireworks API error:', error);
            throw new Error(`Fireworks API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}