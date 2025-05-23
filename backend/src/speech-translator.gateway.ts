import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SpeechTranslatorService } from './speech-translator.service';
import { UsageTrackerService } from './usage-tracker.service';
import { systemPrompt } from './system-prompt';

// Define supported languages
const SUPPORTED_LANGUAGES = ['en-US', 'hi-IN', 'pa-IN', 'mr-IN'] as const;
type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

interface SpeechToTextPayload {
    audioBuffer: Buffer;
    language: LanguageCode;
    speakingRate?: number;
    pitch?: number;
    voiceName?: string;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface LanguageInfo {
    code: LanguageCode;
    name: string;
    voices: Record<string, string>;
}

type VoiceType = 'standard-female' | 'standard-male' | 'neural-female' | 'neural-male' | 'wavenet-female' | 'wavenet-male';

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class SpeechTranslatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;

    private clientLanguages = new Map<string, LanguageCode>();
    private clientConversations = new Map<string, ChatMessage[]>();

    // Language configuration with voice options
    private readonly languageConfig: Record<LanguageCode, LanguageInfo> = {
        'en-US': {
            code: 'en-US',
            name: 'English',
            voices: {
                'standard-female': 'en-US-Standard-A',
                'standard-male': 'en-US-Standard-B',
                'neural-female': 'en-US-Neural2-A',
                'neural-male': 'en-US-Neural2-B',
                'wavenet-female': 'en-US-Wavenet-A',
                'wavenet-male': 'en-US-Wavenet-B'
            }
        },
        'hi-IN': {
            code: 'hi-IN',
            name: 'हिंदी',
            voices: {
                'standard-female': 'hi-IN-Standard-A',
                'standard-male': 'hi-IN-Standard-B',
                'neural-female': 'hi-IN-Neural2-A',
                'neural-male': 'hi-IN-Neural2-B',
                'wavenet-female': 'hi-IN-Wavenet-A',
                'wavenet-male': 'hi-IN-Wavenet-B'
            }
        },
        'pa-IN': {
            code: 'pa-IN',
            name: 'ਪੰਜਾਬੀ',
            voices: {
                'standard-female': 'pa-IN-Standard-A',
                'standard-male': 'pa-IN-Standard-B',
                'neural-female': 'pa-IN-Standard-A', // Fallback to standard
                'neural-male': 'pa-IN-Standard-B',   // Fallback to standard
                'wavenet-female': 'pa-IN-Wavenet-A',
                'wavenet-male': 'pa-IN-Wavenet-B'
            }
        },
        'mr-IN': {
            code: 'mr-IN',
            name: 'मराठी',
            voices: {
                'standard-female': 'mr-IN-Standard-A',
                'standard-male': 'mr-IN-Standard-B',
                'neural-female': 'mr-IN-Standard-A', // Fallback to standard
                'neural-male': 'mr-IN-Standard-B',   // Fallback to standard
                'wavenet-female': 'mr-IN-Wavenet-A',
                'wavenet-male': 'mr-IN-Wavenet-B'
            }
        }
    };

    constructor(
        private readonly speechTranslatorService: SpeechTranslatorService,
        private readonly usageTracker: UsageTrackerService

    ) { }

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
        // Set default language and API provider
        this.clientLanguages.set(client.id, 'en-US');
        client.data.apiProvider = 'openrouter';
        client.data.useRag = true; // Default RAG to enabled
        if (this.clientLanguages.get(client.id) === 'pa-IN') {
            this.clientConversations.set(client.id, [{ role: 'system', content: systemPrompt }]); // Initialize conversation history
        } else {
            this.clientConversations.set(client.id, []); // Initialize conversation history
        }
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
        this.clientLanguages.delete(client.id);
        this.clientConversations.delete(client.id); // Clean up conversation history
    }

    @SubscribeMessage('set-language')
    handleSetLanguage(@MessageBody() language: LanguageCode, @ConnectedSocket() client: Socket) {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            client.emit('error', {
                message: `Unsupported language. Supported languages are: ${SUPPORTED_LANGUAGES.join(', ')}`
            });
            return;
        }
        this.clientLanguages.set(client.id, language);
        client.data.languageCode = language;
        console.log(`Client ${client.id} set language to ${language}`);
    }

    @SubscribeMessage('set-api-provider')
    handleSetApiProvider(
        @MessageBody() provider: 'gpt' | 'openrouter' | 'fireworks',
        @ConnectedSocket() client: Socket,
    ) {
        client.data.apiProvider = provider;
        this.speechTranslatorService.setApiProvider(provider);
        console.log(`API provider set to ${provider} for client ${client.id}`);
    }

    @SubscribeMessage('toggle-rag')
    handleToggleRag(
        @MessageBody() useRag: boolean,
        @ConnectedSocket() client: Socket,
    ) {
        client.data.useRag = useRag;
        this.speechTranslatorService.setUseRag(useRag);
        console.log(`RAG system ${useRag ? 'enabled' : 'disabled'} for client ${client.id}`);
    }

    @SubscribeMessage('speech-to-text')
    async handleSpeechToText(
        @MessageBody() payload: SpeechToTextPayload & { apiProvider?: 'gpt' | 'openrouter' | 'fireworks'; useRag?: boolean },
        @ConnectedSocket() client: Socket,
    ) {
        // Set API provider if provided in the request
        if (payload.apiProvider) {
            this.speechTranslatorService.setApiProvider(payload.apiProvider);
            client.data.apiProvider = payload.apiProvider;
        }

        // Set RAG usage if provided in the request
        if (payload.useRag !== undefined) {
            this.speechTranslatorService.setUseRag(payload.useRag);
            client.data.useRag = payload.useRag;
        }

        try {
            const { audioBuffer, speakingRate = 1.0, pitch = 0, language, voiceName } = payload;

            // Validate language
            if (!SUPPORTED_LANGUAGES.includes(language)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            // Process the speech
            const transcription = await this.speechTranslatorService.transcribeSpeech(
                audioBuffer,
                language
            );

            // Retrieve the conversation history for the client
            let sysPrompt: ChatMessage[] = [];
            if (this.clientLanguages.get(client.id) === 'pa-IN') {
                sysPrompt = [{ role: 'system', content: systemPrompt }];
            }
            this.clientLanguages.get(client.id);
            const conversationHistory = this.clientConversations.get(client.id) || sysPrompt;

            // Generate AI response with conversation history
            const aiResponse = await this.speechTranslatorService.generateAIResponse(
                transcription,
                language,
                conversationHistory
            );

            // Clean up markdown formatting from AI response
            const cleanedResponse = aiResponse
                .replace(/\*\*/g, '') // Remove bold formatting
                .replace(/##\s*/g, '') // Remove h2 headers
                .replace(/###\s*/g, '') // Remove h3 headers
                .replace(/^-\s*/gm, '') // Remove list items
                .replace(/\s{2,}/g, ' '); // Replace double spaces with single space

            // Update conversation history
            conversationHistory.push({ role: 'user', content: transcription });
            conversationHistory.push({ role: 'assistant', content: cleanedResponse });
            this.clientConversations.set(client.id, conversationHistory);
            console.log(this.clientConversations);

            // Convert response to speech
            const speechResponse = await this.speechTranslatorService.textToSpeech({
                text: cleanedResponse,
                speakingRate,
                languageCode: language,
                pitch,
                voiceName
            });

            // Get usage summary
            const usageSummary = this.usageTracker.getUsageSummary();

            // Send back to client
            client.emit('text-to-speech', {
                transcription,
                aiResponse: cleanedResponse,
                audioBuffer: speechResponse,
                language,
                usage: {
                    speechToText: usageSummary.total.speechToText,
                    chatGPT: usageSummary.total.chatGPT,
                    textToSpeech: usageSummary.total.textToSpeech,
                    totalCost: usageSummary.total.totalCost
                }
            });

        } catch (error) {
            console.error('Error processing speech:', error);
            client.emit('error', {
                message: error instanceof Error
                    ? error.message
                    : 'An error occurred while processing your request'
            });
        }
    }

    @SubscribeMessage('get-usage-stats')
    async getUsageStats(client: Socket) {
        try {
            const usageSummary = this.usageTracker.getUsageSummary();
            client.emit('usage-stats', usageSummary);
        } catch (error) {
            console.error('Error getting usage stats:', error);
            client.emit('error', {
                message: 'An error occurred while fetching usage statistics'
            });
        }
    }

    @SubscribeMessage('get-supported-languages')
    handleGetSupportedLanguages(client: Socket) {
        const languages = Object.values(this.languageConfig).map(lang => ({
            code: lang.code,
            name: lang.name,
            voices: lang.voices
        }));

        client.emit('supported-languages', { languages });
    }

    @SubscribeMessage('get-voice-options')
    handleGetVoiceOptions(client: Socket, language: LanguageCode) {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            client.emit('error', {
                message: `Unsupported language: ${language}`
            });
            return;
        }

        const { voices } = this.languageConfig[language];
        client.emit('voice-options', { voices });
    }
}