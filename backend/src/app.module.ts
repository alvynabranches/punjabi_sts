import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpeechTranslatorModule } from './speech-translator.module';
import { UsageTrackerModule } from './usage-tracker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,  // Make config globally available
      envFilePath: '.env'
    }),
    UsageTrackerModule,
    SpeechTranslatorModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }