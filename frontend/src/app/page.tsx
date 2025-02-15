'use client';

import React, { useState, useRef, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { Mic, StopCircle, Volume2, Copy, RefreshCcw } from 'lucide-react';

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
  // Define types
  type SupportedLanguage = 'en-US' | 'hi-IN' | 'pa-IN' | 'mr-IN';
  type VoiceType = 'standard-female' | 'standard-male' | 'neural-female' | 'neural-male' | 'wavenet-female' | 'wavenet-male';

  // State management with explicit types
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<typeof Socket | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [speakingRate, setSpeakingRate] = useState<number>(1.0);
  const [language, setLanguage] = useState<SupportedLanguage>('en-US');
  const [pitch, setPitch] = useState<number>(0);
  const [voiceType, setVoiceType] = useState<VoiceType>('standard-male');
  const [conversationHistory, setConversationHistory] = useState<{ user: string; ai: string }[]>([]);

  // Add state for animations
  const [isAnimating, setIsAnimating] = useState(false);
  const [showCopiedFeedback, setShowCopiedFeedback] = useState(false);

  // Copy to clipboard function with animation
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setShowCopiedFeedback(true);
    setTimeout(() => setShowCopiedFeedback(false), 2000);
  };

  // Enhanced recording animations
  const startRecordingWithAnimation = () => {
    startRecording();
    setIsAnimating(true);
  };

  // Mic animation component
  const AnimatedMic = () => (
    <div className={`transition-all duration-500 ${isRecording ? 'animate-pulse' : ''}`}>
      {isRecording ? (
        <div className="absolute inset-0 bg-red-500/20 animate-ping rounded-full"></div>
      ) : null}
      <Mic
        className={`w-12 h-12 ${isRecording ? 'text-red-500' : 'text-blue-500'}`}
      />
    </div>
  );

  // Voice options with proper typing
  const voiceOptions: Record<SupportedLanguage, Record<VoiceType, string>> = {
    'en-US': {
      'standard-female': 'en-IN-Standard-A',
      'standard-male': 'en-IN-Standard-B',
      'neural-female': 'en-IN-Neural2-A',
      'neural-male': 'en-IN-Neural2-B',
      'wavenet-female': 'en-IN-Wavenet-A',
      'wavenet-male': 'en-IN-Wavenet-B',
    },
    'hi-IN': {
      'standard-female': 'hi-IN-Standard-A',
      'standard-male': 'hi-IN-Standard-B',
      'neural-female': 'hi-IN-Neural2-A',
      'neural-male': 'hi-IN-Neural2-B',
      'wavenet-female': 'hi-IN-Wavenet-A',
      'wavenet-male': 'hi-IN-Wavenet-B',
    },
    'pa-IN': {
      'standard-female': 'pa-IN-Standard-A',
      'standard-male': 'pa-IN-Standard-B',
      'neural-female': 'pa-IN-Standard-A', // Fallback to standard for unsupported types
      'neural-male': 'pa-IN-Standard-B',
      'wavenet-female': 'pa-IN-Wavenet-A',
      'wavenet-male': 'pa-IN-Wavenet-B',
    },
    'mr-IN': {
      'standard-female': 'mr-IN-Standard-A',
      'standard-male': 'mr-IN-Standard-B',
      'neural-female': 'mr-IN-Standard-A', // Fallback to standard for unsupported types
      'neural-male': 'mr-IN-Standard-B',
      'wavenet-female': 'mr-IN-Wavenet-A',
      'wavenet-male': 'mr-IN-Wavenet-B',
    },
  };

  // Refs with proper typing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Language change handler with proper typing
  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value as SupportedLanguage;
    setLanguage(newLanguage);
    if (socket) {
      socket.emit('set-language', newLanguage);
    }
  };

  // Voice type change handler with proper typing
  const handleVoiceTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoiceType = event.target.value as VoiceType;
    setVoiceType(newVoiceType);
  };

  // Update socket connection with language
  useEffect(() => {
    if (socket) {
      socket.emit('set-language', language);
    }
  }, [language, socket]);

  // Socket connection and event handling
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001");
    setSocket(newSocket);

    newSocket.on('connect_error', (err: Error) => {
      setError(`Socket connection error: ${err.message}`);
    });

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

      // Update conversation history
      setConversationHistory(prev => [...prev, { user: data.transcription, ai: data.aiResponse }]);

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

    newSocket.on('error', (errorMsg: string | { message: string }) => {
      // Handle both string and error object cases
      const errorString = typeof errorMsg === 'string' ? errorMsg : errorMsg.message;
      setError(errorString);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Start recording method
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (socket) {
          socket.emit('speech-to-text', {
            audioBuffer: audioBlob,
            speakingRate,
            language,
            pitch,
            voiceName: voiceOptions[language][voiceType]
          });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to access microphone';
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
        {/* Animated Title */}
        <h1 className="text-3xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 animate-text">
          Speech Assistant
        </h1>

        {/* Error Handling with Animation */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded animate-shake">
            {error}
          </div>
        )}

        {/* Language Selector */}
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

        {/* Voice Type Selector */}
        <div className="mb-6">
          <label htmlFor="voice-select" className="block text-sm font-medium text-gray-700 mb-2">
            Voice Type
          </label>
          <select
            id="voice-select"
            value={voiceType}
            onChange={handleVoiceTypeChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="standard-female">Standard Female</option>
            <option value="standard-male">Standard Male</option>
            {language !== 'pa-IN' && language !== 'mr-IN' && (
              <>
                <option value="neural-female">Neural Female</option>
                <option value="neural-male">Neural Male</option>
              </>
            )}
            <option value="wavenet-female">Wavenet Female</option>
            <option value="wavenet-male">Wavenet Male</option>
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
        </div>

        {/* Pitch Control Slider */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pitch: {pitch.toFixed(1)}
          </label>
          <input
            type="range"
            min="-20"
            max="20"
            step="1"
            value={pitch}
            onChange={(e) => setPitch(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Recording Button */}
        <div className="flex justify-center items-center space-x-4 mb-4 relative">
          <div className="relative">
            {!isRecording ? (
              <button
                onClick={startRecordingWithAnimation}
                className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-all transform hover:scale-110"
                disabled={!!error}
              >
                <AnimatedMic />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="bg-red-500 text-white p-3 rounded-full hover:bg-red-600 transition-all transform hover:scale-110"
              >
                <StopCircle className="w-12 h-12" />
              </button>
            )}
          </div>
        </div>

        {/* Conversation History */}
        <div className="conversation-history mb-4">
          {conversationHistory.map((entry, index) => (
            <div key={index} className="mb-2">
              <div className="font-semibold text-blue-600">You:</div>
              <div className="text-gray-800">{entry.user}</div>
              <div className="font-semibold text-green-600">AI:</div>
              <div className="text-gray-800">{entry.ai}</div>
            </div>
          ))}
        </div>

        {/* Reset Conversation Button */}
        <button
          onClick={() => {
            setConversationHistory([]);
            setTranscription('');
            setAiResponse('');
            setUsage(null);
            setError(null);
          }}
          className="bg-gray-500 text-white p-2 rounded hover:bg-gray-600 transition"
        >
          Reset Conversation
        </button>

        {/* Transcription Display */}
        {/* Enhanced Transcription and Response Display */}
        {transcription && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow-inner relative">
            <h2 className="font-semibold text-gray-700 mb-2">Your Message:</h2>
            <p className="text-gray-800">{transcription}</p>
            <button
              onClick={() => copyToClipboard(transcription)}
              className="absolute top-2 right-2 text-gray-500 hover:text-blue-500 transition"
            >
              <Copy className="w-5 h-5" />
            </button>
            {showCopiedFeedback && (
              <div className="absolute -top-8 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded">
                Copied!
              </div>
            )}
          </div>
        )}

        {/* AI Response Display */}
        {aiResponse && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow-inner relative">
            <h2 className="font-semibold text-gray-700 mb-2">AI Response:</h2>
            <p className="text-gray-800">{aiResponse}</p>
            <button
              onClick={() => copyToClipboard(aiResponse)}
              className="absolute top-2 right-2 text-gray-500 hover:text-blue-500 transition"
            >
              <Copy className="w-5 h-5" />
            </button>
            {showCopiedFeedback && (
              <div className="absolute -top-8 right-0 bg-green-500 text-white text-xs px-2 py-1 rounded">
                Copied!
              </div>
            )}
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
                <table>
                  <thead>
                    <tr>
                      <th>Duration</th>
                      <th>Cost</th>
                      <th>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody><tr>
                    <td>{usage.speechToText.totalDuration.toFixed(2)}s</td>
                    <td>${usage.speechToText.totalCost.toFixed(4)}</td>
                    <td>{usage.speechToText.successRate.toFixed(1)}%</td>
                  </tr></tbody>
                </table>
              </div>

              <div>
                <h4 className="font-medium">ChatGPT</h4>
                <table>
                  <thead><tr>
                    <th>Model</th>
                    <th>Input Tokens</th>
                    <th>Output Tokens</th>
                    <th>Cost</th>
                    <th>Success Rate</th>
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td>{usage.chatGPT.totalInputTokens}</td>
                      <td>{usage.chatGPT.totalOutputTokens}</td>
                      <td>${usage.chatGPT.totalCost.toFixed(4)}</td>
                      <td>{usage.chatGPT.successRate.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="font-medium">Text-to-Speech</h4>
                <table>
                  <thead><tr>
                    <th>Characters</th>
                    <th>Cost</th>
                    <th>Success Rate</th>
                  </tr></thead>
                  <tbody><tr>
                    <td>{usage.textToSpeech.totalCharacters}</td>
                    <td>${usage.textToSpeech.totalCost.toFixed(4)}</td>
                    <td>{usage.textToSpeech.successRate.toFixed(1)}%</td>
                  </tr></tbody>
                </table>
              </div>

              <div className="pt-2 border-t">
                <p className="font-medium">Total Cost: <b>${usage.totalCost.toFixed(4)}</b></p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}