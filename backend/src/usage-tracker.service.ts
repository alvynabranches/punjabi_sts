import { Injectable } from '@nestjs/common';
import { encoding_for_model, TiktokenModel } from 'tiktoken';

// Define supported model names
type SupportedModel = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-0613' | 'gpt-3.5-turbo' |
    'gpt-3.5-turbo-0613' | 'gpt-4o' | 'gpt-4o-mini';

// Define voice type
type VoiceType = 'STANDARD' | 'WAVENET' | 'NEURAL' | 'JOURNEY';

// Update APIUsage interface to include voice type
interface APIUsage {
    timestamp: Date;
    type: 'speech-to-text' | 'text-to-speech' | 'chatgpt';
    duration?: number;
    inputTokens?: number;
    outputTokens?: number;
    cost: number;
    metadata: {
        model?: string;
        voiceType?: VoiceType;
        inputLength?: number;
        outputLength?: number;
        success: boolean;
        error?: string;
    };
}

@Injectable()
export class UsageTrackerService {
    private usageLog: APIUsage[] = [];

    // Constants for cost calculation
    private readonly COSTS = {
        SPEECH_TO_TEXT_PER_15_SECONDS: 0.006,
        TEXT_TO_SPEECH: {
            STANDARD: 0.000004,  // $4 per 1M characters
            WAVENET: 0.000016,   // $16 per 1M characters
            NEURAL: 0.000016,    // $16 per 1M characters
            JOURNEY: 0.000030    // $30 per 1M characters
        } as const,
        GPT4_INPUT_PER_1K_TOKENS: 0.03,
        GPT4_OUTPUT_PER_1K_TOKENS: 0.06,
        GPT4O_INPUT_PER_1K_TOKENS: 0.01,
        GPT4O_OUTPUT_PER_1K_TOKENS: 0.03,
        GPT4O_MINI_INPUT_PER_1K_TOKENS: 0.005,
        GPT4O_MINI_OUTPUT_PER_1K_TOKENS: 0.015
    } as const;

    private readonly SUPPORTED_MODELS: Record<SupportedModel, TiktokenModel> = {
        'gpt-4': 'gpt-4',
        'gpt-4-0314': 'gpt-4-0314',
        'gpt-4-0613': 'gpt-4-0613',
        'gpt-3.5-turbo': 'gpt-3.5-turbo',
        'gpt-3.5-turbo-0613': 'gpt-3.5-turbo-0613',
        'gpt-4o': 'gpt-4o',
        'gpt-4o-mini': 'gpt-4o-mini'
    };

    private isValidModel(model: string): model is SupportedModel {
        return model in this.SUPPORTED_MODELS;
    }

    private getModelCosts(model: SupportedModel) {
        switch (model) {
            case 'gpt-4o':
                return {
                    input: this.COSTS.GPT4O_INPUT_PER_1K_TOKENS,
                    output: this.COSTS.GPT4O_OUTPUT_PER_1K_TOKENS
                };
            case 'gpt-4o-mini':
                return {
                    input: this.COSTS.GPT4O_MINI_INPUT_PER_1K_TOKENS,
                    output: this.COSTS.GPT4O_MINI_OUTPUT_PER_1K_TOKENS
                };
            default:
                return {
                    input: this.COSTS.GPT4_INPUT_PER_1K_TOKENS,
                    output: this.COSTS.GPT4_OUTPUT_PER_1K_TOKENS
                };
        }
    }

    private countTokens(text: string, modelName: string = 'gpt-4'): number {
        try {
            // Validate and get the model
            const validModelName = this.isValidModel(modelName) ? modelName : 'gpt-4';
            const model = this.SUPPORTED_MODELS[validModelName];

            const enc = encoding_for_model(model);
            const tokens = enc.encode(text);
            enc.free();
            return tokens.length;
        } catch (error) {
            console.error('Error counting tokens:', error);
            return Math.ceil(text.length / 4);
        }
    }

    // Helper method to determine voice type and cost
    private getVoiceTypeAndCost(voiceName: string): { type: VoiceType; cost: number } {
        if (voiceName.includes('Standard')) {
            return { type: 'STANDARD', cost: this.COSTS.TEXT_TO_SPEECH.STANDARD };
        } else if (voiceName.includes('Wavenet')) {
            return { type: 'WAVENET', cost: this.COSTS.TEXT_TO_SPEECH.WAVENET };
        } else if (voiceName.includes('Neural')) {
            return { type: 'NEURAL', cost: this.COSTS.TEXT_TO_SPEECH.NEURAL };
        } else if (voiceName.includes('Journey')) {
            return { type: 'JOURNEY', cost: this.COSTS.TEXT_TO_SPEECH.JOURNEY };
        }
        return { type: 'STANDARD', cost: this.COSTS.TEXT_TO_SPEECH.STANDARD }; // Default
    }

    trackSpeechToText(durationMs: number, success: boolean, error?: string) {
        const usage: APIUsage = {
            timestamp: new Date(),
            type: 'speech-to-text',
            duration: durationMs / 1000,
            cost: (durationMs / 15000) * this.COSTS.SPEECH_TO_TEXT_PER_15_SECONDS,
            metadata: {
                success,
                error
            }
        };
        this.usageLog.push(usage);
        this.logUsage(usage);
        return usage;
    }

    trackChatGPT(prompt: string, response: string, modelName: string, success: boolean, error?: string) {
        // Validate model name
        const validModelName = this.isValidModel(modelName) ? modelName : 'gpt-4';

        const inputTokens = this.countTokens(prompt, validModelName);
        const outputTokens = success ? this.countTokens(response, validModelName) : 0;
        const modelCosts = this.getModelCosts(validModelName);

        const usage: APIUsage = {
            timestamp: new Date(),
            type: 'chatgpt',
            inputTokens,
            outputTokens,
            cost: (
                (inputTokens / 1000) * modelCosts.input +
                (outputTokens / 1000) * modelCosts.output
            ),
            metadata: {
                model: validModelName,
                inputLength: prompt.length,
                outputLength: response.length,
                success,
                error
            }
        };
        this.usageLog.push(usage);
        this.logUsage(usage);
        return usage;
    }

    trackTextToSpeech(text: string, success: boolean, error?: string, voiceName: string = 'Standard') {
        const { type: voiceType, cost: costPerChar } = this.getVoiceTypeAndCost(voiceName);

        const usage: APIUsage = {
            timestamp: new Date(),
            type: 'text-to-speech',
            cost: (text.length / 1000000) * costPerChar * 1000000, // Convert to per-character cost
            metadata: {
                voiceType,
                inputLength: text.length,
                success,
                error
            }
        };

        this.usageLog.push(usage);
        this.logUsage(usage);
        return usage;
    }

    getUsageSummary() {
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        return {
            total: this.calculateSummary(this.usageLog),
            last24Hours: this.calculateSummary(
                this.usageLog.filter(usage => usage.timestamp >= last24Hours)
            ),
            last30Days: this.calculateSummary(
                this.usageLog.filter(usage => usage.timestamp >= last30Days)
            )
        };
    }

    private calculateSummary(usageLog: APIUsage[]) {
        const textToSpeechUsage = usageLog.filter(u => u.type === 'text-to-speech');

        const voiceTypeBreakdown = {
            standard: this.calculateVoiceTypeUsage(textToSpeechUsage, 'STANDARD'),
            wavenet: this.calculateVoiceTypeUsage(textToSpeechUsage, 'WAVENET'),
            neural: this.calculateVoiceTypeUsage(textToSpeechUsage, 'NEURAL'),
            journey: this.calculateVoiceTypeUsage(textToSpeechUsage, 'JOURNEY')
        };

        return {
            totalCost: usageLog.reduce((sum, usage) => sum + usage.cost, 0),
            speechToText: {
                totalDuration: usageLog
                    .filter(u => u.type === 'speech-to-text')
                    .reduce((sum, usage) => sum + (usage.duration || 0), 0),
                totalCost: usageLog
                    .filter(u => u.type === 'speech-to-text')
                    .reduce((sum, usage) => sum + usage.cost, 0),
                successRate: this.calculateSuccessRate(usageLog, 'speech-to-text')
            },
            chatGPT: {
                totalInputTokens: usageLog
                    .filter(u => u.type === 'chatgpt')
                    .reduce((sum, usage) => sum + (usage.inputTokens || 0), 0),
                totalOutputTokens: usageLog
                    .filter(u => u.type === 'chatgpt')
                    .reduce((sum, usage) => sum + (usage.outputTokens || 0), 0),
                totalCost: usageLog
                    .filter(u => u.type === 'chatgpt')
                    .reduce((sum, usage) => sum + usage.cost, 0),
                successRate: this.calculateSuccessRate(usageLog, 'chatgpt')
            },
            textToSpeech: {
                totalCharacters: textToSpeechUsage
                    .reduce((sum, usage) => sum + (usage.metadata?.inputLength || 0), 0),
                totalCost: textToSpeechUsage
                    .reduce((sum, usage) => sum + usage.cost, 0),
                successRate: this.calculateSuccessRate(usageLog, 'text-to-speech'),
                voiceTypes: voiceTypeBreakdown
            }
        };
    }

    private calculateVoiceTypeUsage(usageLog: APIUsage[], voiceType: VoiceType) {
        const voiceTypeUsage = usageLog.filter(u => u.metadata.voiceType === voiceType);
        return {
            characters: voiceTypeUsage.reduce((sum, u) => sum + (u.metadata.inputLength || 0), 0),
            cost: voiceTypeUsage.reduce((sum, u) => sum + u.cost, 0),
            count: voiceTypeUsage.length
        };
    }

    private calculateSuccessRate(usageLog: APIUsage[], type: APIUsage['type']): number {
        const typeUsage = usageLog.filter(u => u.type === type);
        if (typeUsage.length === 0) { return 100 };
        const successful = typeUsage.filter(u => u.metadata.success).length;
        return (successful / typeUsage.length) * 100;
    }

    private logUsage(usage: APIUsage) {
        console.log(`[${usage.timestamp.toISOString()}] API Usage:`, {
            type: usage.type,
            cost: usage.cost.toFixed(6),
            ...(usage.duration && { duration: usage.duration.toFixed(2) + 's' }),
            ...(usage.inputTokens && { inputTokens: usage.inputTokens }),
            ...(usage.outputTokens && { outputTokens: usage.outputTokens }),
            ...(usage.metadata.voiceType && { voiceType: usage.metadata.voiceType }),
            model: usage.metadata.model,
            success: usage.metadata.success
        });
    }
}