import { Injectable } from '@nestjs/common';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { UsageTrackerService } from './usage-tracker.service';
import { OpenRouterService } from './services/openrouter.service';
import { FireworksService } from './services/fireworks.service';
import { RagService } from './services/rag.service';
import { OpenAI } from 'openai';
import {systemPrompt} from './system-prompt'

// Define supported languages
const SUPPORTED_LANGUAGES = ['en-US', 'hi-IN', 'pa-IN', 'mr-IN'] as const;
type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

interface APIError {
    message: string;
    code?: string | number;
    details?: unknown;
}

interface TextToSpeechOptions {
    text: string;
    speakingRate?: number;
    languageCode?: LanguageCode;
    pitch?: number;
    voiceName?: string;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

type ApiProvider = 'gpt' | 'openrouter' | 'fireworks';

@Injectable()
export class SpeechTranslatorService {
    private speechClient: SpeechClient;
    private textToSpeechClient: TextToSpeechClient;
    private openai: OpenAI;
    private readonly MODEL_NAME = 'gpt-4o-mini';
    private apiProvider: ApiProvider = 'gpt';
    private useRag: boolean = true; // Flag to enable/disable RAG

    // Language name mapping with proper typing
    private readonly languageNames: Record<LanguageCode, string> = {
        'en-US': 'English',
        'hi-IN': 'Hindi',
        'pa-IN': 'Punjabi',
        'mr-IN': 'Marathi'
    };

    constructor(
        private readonly usageTracker: UsageTrackerService,
        private readonly openRouterService: OpenRouterService,
        private readonly fireworksService: FireworksService,
        private readonly ragService: RagService
    ) {
        this.speechClient = new SpeechClient();
        this.textToSpeechClient = new TextToSpeechClient();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    setApiProvider(provider: ApiProvider): void {
        this.apiProvider = provider;
        console.log(`API provider set to: ${provider}`);
    }

    setUseRag(useRag: boolean): void {
        this.useRag = useRag;
        console.log(`RAG system ${useRag ? 'enabled' : 'disabled'}`);
    }

    async transcribeSpeech(audioBuffer: Buffer, languageCode: LanguageCode = 'en-US'): Promise<string> {
        const startTime = Date.now();
        try {
            const [response] = await this.speechClient.recognize({
                audio: { content: audioBuffer.toString('base64') },
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,
                    languageCode,
                }
            });

            const duration = Date.now() - startTime;
            this.usageTracker.trackSpeechToText(duration, true);

            return response.results?.[0]?.alternatives?.[0]?.transcript || '';

        } catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = this.getErrorMessage(error);
            this.usageTracker.trackSpeechToText(duration, false, errorMessage);
            console.error('Speech transcription error:', error);
            throw new Error(`Speech transcription failed: ${errorMessage}`);
        }
    }

    async generateAIResponse(
        prompt: string,
        languageCode: LanguageCode = 'en-US',
        conversationHistory: ChatMessage[] = []
    ): Promise<string> {
        try {
            // Check if we should use RAG for this query
            let ragContext = '';
            if (this.useRag && this.isGurbaniQuery(prompt, languageCode)) {
                try {
                    // Search for relevant Gurbani passages
                    const searchResults = await this.ragService.searchGurbani(prompt, 10);
                    
                    if (searchResults.length > 0) {
                        // Format the search results into a readable context
                        ragContext = this.ragService.formatSearchResults(searchResults, languageCode);
                        console.log('RAG context generated successfully');
                    }
                } catch (error) {
                    console.error('Error generating RAG context:', error);
                    // Continue without RAG if there's an error
                }
            }

            const languageName = this.languageNames[languageCode];
            
            // Construct the messages array with the correct type
            const messages: ChatMessage[] = [];
            
            // If RAG is enabled and we have context, use a special prompt format
            if (this.useRag && ragContext) {
                messages.push({
                    role: 'system',
                    content: systemPrompt
                });
                
                messages.push({
                    role: 'user',
                    content: `${prompt}\n\n${ragContext}\n\nReturn the results in ${languageName} only.`
                });
            } else {
                // Standard prompt without RAG
                messages.push({
                    role: 'system',
                    content: `You are a helpful assistant who responds in ${languageName}. 
                        Keep your responses natural, conversational, and concise.`
                });
                
                // Add conversation history
                messages.push(...conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })));
                
                // Add the user's prompt
                messages.push({
                    role: 'user',
                    content: prompt
                });
            }

            let response = '';
            let modelName = '';

            switch (this.apiProvider) {
                case 'openrouter':
                    response = await this.openRouterService.generateResponse(messages);
                    modelName = 'openrouter-qwen3';
                    break;

                case 'fireworks':
                    response = await this.fireworksService.generateResponse(messages);
                    modelName = 'fireworks-qwen3';
                    break;

                case 'gpt':
                default:
                    const chatCompletion = await this.openai.chat.completions.create({
                        model: this.MODEL_NAME,
                        messages: messages,
                        max_tokens: 2048,
                        temperature: 0.7,
                        top_p: 0.9,
                        frequency_penalty: 0.0,
                        presence_penalty: 0.6
                    });
                    response = chatCompletion.choices[0]?.message?.content || '';
                    modelName = this.MODEL_NAME;
                    break;
            }

            // Track successful API usage
            this.usageTracker.trackChatGPT(
                prompt,
                response,
                modelName,
                true
            );

            return response;

        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            // Track failed API usage
            let modelNameForTracking = '';
            
            // Determine the model name based on the API provider
            switch (this.apiProvider) {
                case 'openrouter':
                    modelNameForTracking = 'openrouter-qwen3';
                    break;
                case 'fireworks':
                    modelNameForTracking = 'fireworks-qwen3';
                    break;
                case 'gpt':
                default:
                    modelNameForTracking = this.MODEL_NAME;
                    break;
            }
            
            this.usageTracker.trackChatGPT(
                prompt,
                '',
                modelNameForTracking,
                false,
                errorMessage
            );
            console.error('AI response generation error:', error);
            throw new Error(`AI response generation failed: ${errorMessage}`);
        }
    }

    // Helper method to determine if a query is related to Gurbani
    private isGurbaniQuery(prompt: string, languageCode: LanguageCode): boolean {
        // Always return true when RAG is enabled to use Gurbani knowledge for all queries
        return true;
        
        // The following code is commented out as we now want to use RAG for all queries
        /*
        // Simple heuristic: check if the query contains Gurbani-related keywords
        const englishKeywords = ['gurbani', 'guru', 'granth', 'sahib', 'sikh', 'sikhism', 'waheguru', 'khalsa'];
        const punjabiKeywords = ['ਗੁਰਬਾਣੀ', 'ਗੁਰੂ', 'ਗ੍ਰੰਥ', 'ਸਾਹਿਬ', 'ਸਿੱਖ', 'ਸਿੱਖੀ', 'ਵਾਹਿਗੁਰੂ', 'ਖਾਲਸਾ'];
        
        const lowercasePrompt = prompt.toLowerCase();
        
        if (languageCode === 'pa-IN') {
            return punjabiKeywords.some(keyword => prompt.includes(keyword)) || 
                   englishKeywords.some(keyword => lowercasePrompt.includes(keyword));
        } else {
            return englishKeywords.some(keyword => lowercasePrompt.includes(keyword));
        }
        */
    }

    async textToSpeech({
        text,
        speakingRate = 1.0,
        languageCode = 'en-US',
        pitch = 0,
        voiceName
    }: TextToSpeechOptions): Promise<Buffer> {
        try {
            const [response] = await this.textToSpeechClient.synthesizeSpeech({
                input: { text },
                voice: {
                    languageCode,
                    name: voiceName || this.getVoiceName(languageCode)
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    effectsProfileId: ['headphone-class-device'],
                    speakingRate,
                    pitch,
                    volumeGainDb: 0,
                }
            });
            // Track successful API usage with voice type
            const isStandardVoice = voiceName?.includes('Standard') ?? true;
            const costPerChar = isStandardVoice ? 0.000004 : 0.000016;
            // Track successful API usage
            this.usageTracker.trackTextToSpeech(text, true, undefined, voiceName);

            return response.audioContent as Buffer;

        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            // Track failed API usage
            this.usageTracker.trackTextToSpeech(text, false, errorMessage, voiceName);
            console.error('Text-to-speech conversion error:', error);
            throw new Error(`Text-to-speech conversion failed: ${errorMessage}`);
        }
    }

    private getVoiceName(languageCode: LanguageCode): string {
        // Select appropriate voice based on language code
        switch (languageCode) {
            case 'pa-IN':  // Punjabi
                return 'pa-IN-Standard-A';
            case 'hi-IN':  // Hindi
                return 'hi-IN-Standard-A';
            case 'mr-IN':  // Marathi
                return 'mr-IN-Standard-A';
            case 'en-US':  // English
            default:
                return 'en-US-Standard-A';
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        } else if (typeof error === 'object' && error !== null) {
            const apiError = error as APIError;
            return apiError.message || 'Unknown error';
        } else {
            return String(error);
        }
    }

    getUsageStats() {
        return this.usageTracker.getUsageSummary();
    }
}