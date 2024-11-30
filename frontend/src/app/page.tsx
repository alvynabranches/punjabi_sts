'use client';

import React, { useState, useRef, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

interface UsageStats {
  speechToText: {
    totalDuration: number;
    totalCost: number;
    successRate: number;
  };
  chatGPT: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    successRate: number;
  };
  textToSpeech: {
    totalCharacters: number;
    totalCost: number;
    successRate: number;
  };
  totalCost: number;
}

export default function SpeechTranslator() {
  // Define the language type
  type SupportedLanguage = 'en-US' | 'hi-IN' | 'pa-IN' | 'mr-IN';

  // State management with explicit types
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [speakingRate, setSpeakingRate] = useState<number>(1.0);
  const [language, setLanguage] = useState<'en-US' | 'hi-IN' | 'pa-IN' | 'mr-IN'>('en-US');

  // Language options
  const languages: Array<{
    code: SupportedLanguage;
    name: string;
    label: string;
  }> = [
      { code: 'en-US', name: 'English', label: 'English' },
      { code: 'hi-IN', name: 'Hindi', label: 'हिंदी' },
      { code: 'pa-IN', name: 'Punjabi', label: 'ਪੰਜਾਬੀ' },
      { code: 'mr-IN', name: 'Marathi', label: 'मराठी' }
    ];

  // Refs with proper typing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Language change handler
  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value as 'en-US' | 'hi-IN' | 'pa-IN' | 'mr-IN';
    setLanguage(newLanguage);
    if (socket) {
      socket.emit('set-language', newLanguage);
    }
  };

  // Update socket connection with language
  useEffect(() => {
    if (socket) {
      socket.emit('set-language', language);
    }
  }, [language, socket]);

  // Socket connection and event handling
  useEffect(() => {
    // Establish socket connection
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001");
    setSocket(newSocket);

    // Error handling for socket connection
    newSocket.on('connect_error', (err: Error) => {
      setError(`Socket connection error: ${err.message}`);
    });

    // Listen for text-to-speech response
    newSocket.on('text-to-speech', (data: {
      transcription: string;
      aiResponse: string;
      audioBuffer: ArrayBuffer;
      usage: UsageStats;
    }) => {
      setTranscription(data.transcription);
      setAiResponse(data.aiResponse);
      setUsage(data.usage);
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

      // Request initial usage stats
      newSocket.emit('get-usage-stats');
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


      // Update the stopRecording method to include language
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (socket) {
          socket.emit('speech-to-text', {
            audioBuffer: audioBlob,
            speakingRate,
            language
          });
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
          Speech Assistant
        </h1>

        {/* ... error display ... */}

        {/* Language Selector Dropdown */}
        <div className="mb-6">
          <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Language
          </label>
          <select
            id="language-select"
            value={language}
            onChange={handleLanguageChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="en-US">English</option>
            <option value="hi-IN">हिंदी</option>
            <option value="pa-IN">ਪੰਜਾਬੀ</option>
            <option value="mr-IN">मराठी</option>
          </select>
        </div>

        {/* Speed Control Slider */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Speaking Rate: {speakingRate.toFixed(1)}x
          </label>
          <input
            type="range"
            min="0.25"
            max="4.0"
            step="0.25"
            value={speakingRate}
            onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.25x</span>
            <span>1x</span>
            <span>4x</span>
          </div>
        </div>

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

        {/* Usage Statistics */}
        {usage && (
          <div className="mt-4 text-sm text-gray-600">
            <h3 className="font-semibold mb-2">API Usage Statistics</h3>

            <div className="space-y-2">
              <div>
                <h4 className="font-medium">Speech-to-Text</h4>
                <p>Duration: {usage.speechToText.totalDuration.toFixed(2)}s</p>
                <p>Cost: ${usage.speechToText.totalCost.toFixed(4)}</p>
                <p>Success Rate: {usage.speechToText.successRate.toFixed(1)}%</p>
              </div>

              <div>
                <h4 className="font-medium">ChatGPT</h4>
                <p>Input Tokens: {usage.chatGPT.totalInputTokens}</p>
                <p>Output Tokens: {usage.chatGPT.totalOutputTokens}</p>
                <p>Cost: ${usage.chatGPT.totalCost.toFixed(4)}</p>
                <p>Success Rate: {usage.chatGPT.successRate.toFixed(1)}%</p>
              </div>

              <div>
                <h4 className="font-medium">Text-to-Speech</h4>
                <p>Characters: {usage.textToSpeech.totalCharacters}</p>
                <p>Cost: ${usage.textToSpeech.totalCost.toFixed(4)}</p>
                <p>Success Rate: {usage.textToSpeech.successRate.toFixed(1)}%</p>
              </div>

              <div className="pt-2 border-t">
                <p className="font-medium">Total Cost: ${usage.totalCost.toFixed(4)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}