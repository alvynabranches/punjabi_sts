import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechTranslatorService } from './speech-translator.service';
import { SpeechTranslatorGateway } from './speech-translator.gateway';
import { UsageTrackerModule } from './usage-tracker.module';
import { OpenRouterService } from './services/openrouter.service';
import { FireworksService } from './services/fireworks.service';
import { RagService } from './services/rag.service';

@Module({
    imports: [UsageTrackerModule, ConfigModule],
    providers: [
        SpeechTranslatorService,
        SpeechTranslatorGateway,
        OpenRouterService,
        FireworksService,
        RagService
    ],
    exports: [SpeechTranslatorService]
})
export class SpeechTranslatorModule { }