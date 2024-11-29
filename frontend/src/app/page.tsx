'use client';

import React, { useState, useRef, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

// Detailed interface for socket response
interface SocketResponseData {
  transcription: string;
  aiResponse: string;
  audioBuffer: ArrayBuffer;
}

export default function SpeechTranslator() {
  // State management with explicit types
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<typeof Socket | null>(null);

  // Refs with proper typing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Socket connection and event handling
  useEffect(() => {
    // Establish socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3000');
    setSocket(newSocket);

    // Error handling for socket connection
    newSocket.on('connect_error', (err: Error) => {
      setError(`Socket connection error: ${err.message}`);
    });

    // Listen for text-to-speech response
    newSocket.on('text-to-speech', (data: SocketResponseData) => {
      setTranscription(data.transcription);
      setAiResponse(data.aiResponse);
      setError(null);

      // Audio playback
      if (data.audioBuffer && audioRef.current) {
        try {
          const blob = new Blob([data.audioBuffer], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch((playError) => {
            setError(`Audio playback error: ${playError instanceof Error ? playError.message : 'Unknown error'}`);
          });
        } catch (audioError) {
          setError(`Audio processing error: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`);
        }
      }
    });

    // Socket error handling
    newSocket.on('error', (errorMsg: string) => {
      setError(errorMsg);
    });

    // Cleanup on component unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Start recording method
  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize media recorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      // Collect audio chunks
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      // Process recorded audio
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });

        // Send audio to socket
        if (socket) {
          socket.emit('speech-to-text', audioBlob);
        }
      };

      // Start recording
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);
    } catch (error) {
      // Handle microphone access errors
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unable to access microphone';
      setError(errorMessage);
      console.error('Microphone access error:', error);
    }
  };

  // Stop recording method
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-4 text-center">
          Speech Translator
        </h1>

        {/* ... error display ... */}

        {/* Recording Button */}
        <div className="flex justify-center space-x-4 mb-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition"
              disabled={!!error}
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 transition"
            >
              Stop Recording
            </button>
          )}
        </div>

        {/* Transcription Display */}
        {transcription && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <h2 className="font-semibold">Your Message:</h2>
            <p>{transcription}</p>
          </div>
        )}

        {/* AI Response Display */}
        {aiResponse && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <h2 className="font-semibold">AI Response:</h2>
            <p>{aiResponse}</p>
          </div>
        )}

        {/* Audio Element */}
        <audio ref={audioRef} controls className="w-full mt-4" />
      </div>
    </div>
  );
}