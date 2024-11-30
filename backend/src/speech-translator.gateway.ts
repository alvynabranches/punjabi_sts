import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SpeechTranslatorService } from './speech-translator.service';
import { UsageTrackerService } from './usage-tracker.service';

// Define supported languages
const SUPPORTED_LANGUAGES = ['en-US', 'hi-IN', 'pa-IN', 'mr-IN'] as const;
type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

interface SpeechToTextPayload {
    audioBuffer: Buffer;
    speakingRate?: number;
    language: LanguageCode;
}

@Injectable()
@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})
export class SpeechTranslatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private clientLanguages: Map<string, LanguageCode> = new Map();

    constructor(
        private readonly speechTranslatorService: SpeechTranslatorService,
        private readonly usageTracker: UsageTrackerService
    ) { }

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
        // Set default language
        this.clientLanguages.set(client.id, 'en-US');
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
        this.clientLanguages.delete(client.id);
    }

    @SubscribeMessage('set-language')
    handleSetLanguage(client: Socket, language: LanguageCode) {
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            client.emit('error', { 
                message: `Unsupported language. Supported languages are: ${SUPPORTED_LANGUAGES.join(', ')}` 
            });
            return;
        }
        this.clientLanguages.set(client.id, language);
        console.log(`Client ${client.id} set language to ${language}`);
    }

    @SubscribeMessage('speech-to-text')
    async handleSpeechToText(client: Socket, payload: SpeechToTextPayload) {
        try {
            const { audioBuffer, speakingRate = 1.0, language } = payload;
            
            // Validate language
            if (!SUPPORTED_LANGUAGES.includes(language)) {
                throw new Error(`Unsupported language: ${language}`);
            }

            // Process the speech
            const transcription = await this.speechTranslatorService.transcribeSpeech(
                audioBuffer,
                language
            );

            // Generate AI response
            const aiResponse = await this.speechTranslatorService.generateAIResponse(
                transcription,
                language
            );

            // Convert response to speech
            const speechResponse = await this.speechTranslatorService.textToSpeech(
                aiResponse,
                speakingRate,
                language
            );

            // Get usage summary
            const usageSummary = this.usageTracker.getUsageSummary();

            // Send back to client
            client.emit('text-to-speech', {
                transcription,
                aiResponse,
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
        const languageMap = {
            'en-US': 'English',
            'hi-IN': 'हिंदी',
            'pa-IN': 'ਪੰਜਾਬੀ',
            'mr-IN': 'मराठी'
        };
        
        client.emit('supported-languages', {
            languages: SUPPORTED_LANGUAGES.map(code => ({
                code,
                name: languageMap[code]
            }))
        });
    }
}