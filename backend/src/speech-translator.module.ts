import { Module } from '@nestjs/common';
import { SpeechTranslatorService } from './speech-translator.service';
import { SpeechTranslatorGateway } from './speech-translator.gateway';
import { UsageTrackerModule } from './usage-tracker.module';
import { OpenRouterService } from './services/openrouter.service';
import { FireworksService } from './services/fireworks.service';

@Module({
    imports: [UsageTrackerModule],
    providers: [SpeechTranslatorService, SpeechTranslatorGateway, OpenRouterService, FireworksService],
    exports: [SpeechTranslatorService]
})
export class SpeechTranslatorModule { }