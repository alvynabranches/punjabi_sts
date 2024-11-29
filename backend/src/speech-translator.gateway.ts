import { Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SpeechTranslatorService } from './speech-translator.service';

@Injectable()
@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
})
export class SpeechTranslatorGateway implements OnGatewayConnection, OnGatewayDisconnect {
    // Use definite assignment assertion
    @WebSocketServer()
    server!: Server;

    constructor(private speechTranslatorService: SpeechTranslatorService) { }

    handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('speech-to-text')
    async handleSpeechToText(client: Socket, audioBuffer: Buffer) {
        try {
            // Transcribe speech
            const transcription = await this.speechTranslatorService.transcribeSpeech(audioBuffer);
            // console.log(transcription);

            // Generate AI response
            const aiResponse = await this.speechTranslatorService.generateAIResponse(transcription);
            // console.log(aiResponse);

            // Convert response to speech
            const speechResponse = await this.speechTranslatorService.textToSpeech(aiResponse);

            // Send back to client
            client.emit('text-to-speech', {
                transcription,
                aiResponse,
                audioBuffer: speechResponse
            });

        } catch (error) {
            console.error('Error processing speech:', error);
            client.emit('error', { message: '' }); // Error message in Punjabi
        }
    }
}