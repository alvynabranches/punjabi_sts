import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SpeechTranslatorService } from './speech-translator.service';
import { UsageTrackerService } from './usage-tracker.service';

// Define supported languages
const SUPPORTED_LANGUAGES = ['en-US', 'hi-IN', 'pa-IN', 'mr-IN'] as const;
type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

// Define voice types
type VoiceType = 'standard-female' | 'standard-male' | 'neural-female' | 'neural-male' | 'wavenet-female' | 'wavenet-male';

interface SpeechToTextPayload {
    audioBuffer: Buffer;
    speakingRate?: number;
    pitch?: number;
    language: LanguageCode;
    voiceName?: string;
}

interface LanguageInfo {
    code: LanguageCode;
    name: string;
    voices: Record<VoiceType, string>;
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

    // Language configuration with voice options
    private readonly languageConfig: Record<LanguageCode, LanguageInfo> = {
        'en-US': {
            code: 'en-US',
            name: 'English',
            voices: {
                'standard-female': 'en-IN-Standard-A',
                'standard-male': 'en-IN-Standard-B',
                'neural-female': 'en-IN-Neural2-A',
                'neural-male': 'en-IN-Neural2-B',
                'wavenet-female': 'en-IN-Wavenet-A',
                'wavenet-male': 'en-IN-Wavenet-B'
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

            // Generate AI response
            const aiResponse = await this.speechTranslatorService.generateAIResponse(
                transcription,
                language
            );

            // Convert response to speech
            const speechResponse = await this.speechTranslatorService.textToSpeech({
                text: aiResponse,
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

        const voices = this.languageConfig[language].voices;
        client.emit('voice-options', { voices });
    }
}