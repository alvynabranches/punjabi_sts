import { Injectable } from '@nestjs/common';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';

@Injectable()
export class SpeechTranslatorService {
    private speechClient: SpeechClient;
    private textToSpeechClient: TextToSpeechClient;
    private openai: OpenAI;
    private readonly languageCode: string;

    constructor() {
        this.speechClient = new SpeechClient();
        this.textToSpeechClient = new TextToSpeechClient();
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.languageCode = process.env.LANGUAGE_CODE || 'en-US';
    }

    // Add explicit return type and method implementations
    async transcribeSpeech(audioBuffer: Buffer): Promise<string> {
        try {
            const [response] = await this.speechClient.recognize({
                audio: { content: audioBuffer.toString('base64') },
                config: {
                    encoding: 'WEBM_OPUS',
                    sampleRateHertz: 48000,  // Updated to match the WEBM OPUS header
                    languageCode: this.languageCode,
                }
            });
            return response.results?.[0]?.alternatives?.[0]?.transcript || '';
        } catch (error) {
            console.error('Speech transcription error:', error);
            return '';
        }
    }

    async generateAIResponse(prompt: string): Promise<string> {
        try {
            const chatCompletion = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `You are a helpful assistant who responds in ${this.languageCode === 'en-US' ? 'English' : 'Punjabi'}. Keep your responses natural and conversational.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 2048
            });
            // console.log(chatCompletion.choices[0]?.message?.content);
            return chatCompletion.choices[0]?.message?.content || '';
        } catch (error) {
            console.error('AI response generation error:', error);
            return '';
        }
    }

    async textToSpeech(text: string): Promise<Buffer> {
        try {
            const [response] = await this.textToSpeechClient.synthesizeSpeech({
                input: { text },
                voice: {
                    languageCode: this.languageCode,
                    name: 'pa-IN-Standard-A'
                },
                audioConfig: {
                    audioEncoding: 'MP3',
                    effectsProfileId: ['headphone-class-device'],
                    speakingRate: 1.3,  // Speeds up the speech by 30%
                    pitch: 0,           // Default pitch (can be adjusted from -20.0 to 20.0)
                }
            });

            return response.audioContent as Buffer;
        } catch (error) {
            console.error('Text-to-speech conversion error:', error);
            return Buffer.from('');
        }
    }
}