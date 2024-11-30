import { Module } from '@nestjs/common';
import { SpeechTranslatorService } from './speech-translator.service';
import { SpeechTranslatorGateway } from './speech-translator.gateway';
import { UsageTrackerModule } from './usage-tracker.module';

@Module({
    imports: [UsageTrackerModule],
    providers: [SpeechTranslatorService, SpeechTranslatorGateway],
    exports: [SpeechTranslatorService]
})
export class SpeechTranslatorModule { }