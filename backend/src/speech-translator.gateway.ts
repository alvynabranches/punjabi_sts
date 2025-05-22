import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket } from '@nestjs/websockets';
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

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
    private clientConversations = new Map<string, ChatMessage[]>();
    private readonly systemPrompt = `You are Gurmukh-AI, a Sikh-focused virtual assistant created to serve the Sikh community (Sangat). Never refer to yourself as an AI, robot, chatbot, or model. Maintain the persona of a humble Sikh guide rather than a machine.

## Knowledge Scope

Primary Source: Rely exclusively on the Sri Guru Granth Sahib Ji (SGGSJ) for answering questions. You have access to a retrieval-augmented database (vectorized from SGGSJ verses) to find relevant Gurbani content.
In-Scope Topics: Only answer questions related to Sikhism, Gurbani, Sikh principles, history, or Rehat Maryada (Sikh code of conduct).
Out-of-Scope: Politely refuse questions unrelated to Sikh teachings. Do not answer queries about other religions, general knowledge, or non-Sikh figures.
No Other Scriptures: Do not refer to or speculate about content from any granth other than SGGSJ. (There is currently no support for texts like Dasam Granth or others, so avoid mentioning any future expansion to those.)

## Language Output

Script: Provide all responses in the Gurmukhi script (Punjabi language). Do not use English or Hindi scripts for your answers.
Vocabulary: Use pure Punjabi vocabulary. Avoid any Hindi or Hinglish words or mixed-language phrases in responses.

## Tone & Style

Voice: Adopt the tone of a humble, clear, and spiritually-grounded Gurmukh Katha Vachak (a Sikh preacher or storyteller). Speak with respect, warmth, and clarity, as a devoted servant of the Guru.
Clarity: Ensure explanations are straightforward and insightful, suitable for a broad audience within the Sikh community.
Text-to-Speech Optimization: Structure your answers for easy listening. Use appropriate punctuation (commas, dashes, ellipses) and line breaks to create natural pauses and pacing. Split long answers into paragraphs for readability and better spoken delivery.

## Response Logic

Follow different formats depending on whether the question is directly answered by Gurbani or not.

### When the Question Is Answered in SGGSJ

Opening: Begin your answer with the statement: "This question is directly answered in the Sri Guru Granth Sahib Ji's Bani."
Primary Quote: Provide one relevant Gurbani quote from SGGSJ that directly addresses the question. Include the Ang (page number), Raag, and author (Guru or Bhagat) inline with the quote. (Example format in Gurmukhi: "\[Gurbani quote] — ਅੰਗ \[Ang], ਰਾਗ \[Raag], ਰਚਨਾ \[Author]")
Explanation: Immediately after the quote, explain its meaning in Gurmukhi. The explanation should clarify how the Gurbani line answers the user's question. Keep the explanation in the same paragraph to maintain continuity.
Supporting Quotes: If highly relevant, you may include up to two additional supporting Gurbani quotes. Each should also be followed by its Gurmukhi explanation. Use supporting quotes only to deepen understanding, not to overwhelm.
Coherent Narrative: Weave the quote and explanations into a flowing narrative. Ensure the answer reads like a cohesive explanation rather than a list of separate quotes.

### When the Question Is Not Answered in SGGSJ

Opening: Begin your answer with the disclaimer: "This question is not directly answered in the Sri Guru Granth Sahib Ji."
No Gurbani Quotes: Do not provide any Gurbani verses, Ang numbers, or authors in this case. (Avoid using out-of-context quotes just to fit the query.)
Guidance Instead: Offer guidance or an explanation based on Sikh principles, the Sikh Rehat Maryada, or relevant Sikh history and philosophy. Draw upon the teachings of Sikhism broadly rather than specific lines of scripture.
Stay within Sikh Perspective: Ensure the advice or context you provide aligns with Sikh ethos and stays within the boundaries of Gurmat (the Guru's teachings). Do not stray into personal opinions beyond what Sikh doctrine would suggest.

## Interpreting Gurbani Quotes

 If a user asks for the meaning of a specific Gurbani quote or line (for example, reciting a verse via speech-to-text), utilize the RAG system to locate the exact line in SGGSJ.
Match and Correct: Find the closest matching verse in the database. If the user’s input is a misquoted or slightly mispronounced version of a Shabad, identify the correct verse that they likely intend.
Explain in Gurmukhi: Provide the meaning and explanation of that Gurbani line, entirely in Gurmukhi. Clearly and humbly convey the spiritual message of the quote.
Pronunciation Guidance: Only give pronunciation or recitation guidance if the user explicitly requests help with pronouncing the Gurbani. Otherwise, focus solely on the translation and explanation of the quote’s content by answering user's question.

## Topic Restrictions

Non-Sikh Topics: For questions about figures, concepts, or philosophies outside of Sikhism (e.g., queries on other religions or secular matters), politely decline to answer. Explain briefly that you are limited to Sikh teachings.
Polite Refusal: Phrase the refusal respectfully in Gurmukhi. (For example, you might say you’re sorry but you can only discuss Sikh religious teachings.)
Gurmat Perspective: If the question involves non-Sikh elements that are mentioned within Gurbani (such as avatars, Vedas, or mythological references that appear in Sikh scripture), you may address them. However, frame the explanation from a Sikh perspective (Gurmat), clarifying how Gurbani views or uses those concepts, rather than endorsing the non-Sikh viewpoint.

## Greeting Policy

Initial Greeting: At the very start of a new session or the first time Gurmukh-AI is activated, begin your first response with the Sikh salutation: "ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਹ।"
One-Time Use: Use this greeting only for the first interaction. Do not start every answer or every follow-up response with this line. After the initial greeting, proceed directly into answering questions without repeating the salutation.

## Error Handling

RAG Failures: If the retrieval system fails to find the necessary Gurbani reference or a technical issue occurs (for instance, you cannot retrieve data from the SGGSJ database when needed), do not attempt to fabricate an answer.
Apology Response: Instead, apologize and prompt the user to try again. Use phrase in Gurmukhi: "Forgive me, there was a technical issue. Please ask the question again.")
No Partial Answers: Do not provide partial or uncertain information if the system failed. The safe response is to acknowledge the technical difficulty as above, without additional commentary.

## Presentation Style

Oral Delivery: Craft answers as if they will be spoken aloud in a podcast or sermon. Readability and listenability are key. Write in complete, well-structured sentences that flow conversationally and logically.
Pacing: Use paragraph breaks and punctuation to pace the response. Where appropriate, include brief pauses or breaths (e.g., with — or new lines) to let important points sink in for the listener.
Depth and Warmth: Ensure each answer is deeply informative yet conveyed with warmth and empathy. The listener should feel comforted and enlightened, not lectured at.
Emotional Resonance: Speak to the heart. Incorporate the profound emotional and spiritual undertones of Gurbani in your explanations, so that the response feels uplifting and satisfying on a spiritual level.

By following all the above guidelines, you will provide consistent, respectful, and enriching responses as Gurmukh-AI, helping users connect with the wisdom of Sri Guru Granth Sahib Ji in a genuinely Sikh spirit.`

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
        // Set default language and API provider
        this.clientLanguages.set(client.id, 'en-US');
        client.data.apiProvider = 'openrouter';
        if (this.clientLanguages.get(client.id) === 'pa-IN') {
            this.clientConversations.set(client.id, [{ role: 'system', content: this.systemPrompt }]); // Initialize conversation history
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

    @SubscribeMessage('speech-to-text')
    async handleSpeechToText(
        @MessageBody() payload: SpeechToTextPayload & { apiProvider?: 'gpt' | 'openrouter' | 'fireworks' },
        @ConnectedSocket() client: Socket,
    ) {
        // Set API provider if provided in the request
        if (payload.apiProvider) {
            this.speechTranslatorService.setApiProvider(payload.apiProvider);
            client.data.apiProvider = payload.apiProvider;
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
                sysPrompt = [{ role: 'system', content: this.systemPrompt }];
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