import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SpeechTranslatorService } from '../speech-translator.service';
import { SpeechTranslatorGateway } from '../speech-translator.gateway';

@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    SpeechTranslatorService,
    SpeechTranslatorGateway
  ]
})
export class AppModule { }