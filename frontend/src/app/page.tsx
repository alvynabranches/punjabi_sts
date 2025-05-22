'use client';

import React, { useState, useRef, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { Mic, StopCircle, Copy } from 'lucide-react';

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
    byProvider: {
      openai: ProviderUsage;
      openRouter: ProviderUsage;
      fireworks: ProviderUsage;
    };
  };
  textToSpeech: {
    totalCharacters: number;
    totalCost: number;
    successRate: number;
    voiceTypes?: {
      standard: VoiceTypeUsage;
      wavenet: VoiceTypeUsage;
      neural: VoiceTypeUsage;
      journey: VoiceTypeUsage;
    };
  };
  totalCost: number;
}

interface ProviderUsage {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  successRate: number;
  count: number;
}

interface VoiceTypeUsage {
  characters: number;
  cost: number;
  count: number;
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
  const [language, setLanguage] = useState<SupportedLanguage>('pa-IN');
  const [pitch, setPitch] = useState<number>(0);
  const [voiceType, setVoiceType] = useState<VoiceType>('wavenet-male');
  const [apiProvider, setApiProvider] = useState<'gpt' | 'openrouter' | 'fireworks'>('fireworks');
  const [conversationHistory, setConversationHistory] = useState<{ user: string; ai: string }[]>([]);
  const [useRag, setUseRag] = useState<boolean>(true); // New state for RAG toggle

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
      'standard-female': 'en-US-Standard-A',
      'standard-male': 'en-US-Standard-B',
      'neural-female': 'en-US-Neural2-A',
      'neural-male': 'en-US-Neural2-B',
      'wavenet-female': 'en-US-Wavenet-A',
      'wavenet-male': 'en-US-Wavenet-B',
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

  // API provider change handler
  const handleApiProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as 'gpt' | 'openrouter' | 'fireworks';
    setApiProvider(newProvider);
    if (socket) {
      socket.emit('set-api-provider', newProvider);
    }
  };

  // Voice type change handler with proper typing
  const handleVoiceTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoiceType = event.target.value as VoiceType;
    setVoiceType(newVoiceType);
  };

  // RAG toggle handler
  const handleRagToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newUseRag = event.target.checked;
    setUseRag(newUseRag);
    if (socket) {
      socket.emit('toggle-rag', newUseRag);
    }
  };

  // Update socket connection with language and API provider
  useEffect(() => {
    if (socket) {
      socket.emit('set-language', language);
      socket.emit('set-api-provider', apiProvider);
      socket.emit('toggle-rag', useRag);
    }
  }, [language, apiProvider, useRag, socket]);

  // Socket connection and event handling
  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001", {
      transports: ["websocket", "polling"],  // Enable both WebSocket and polling for better mobile compatibility
      reconnection: true,                    // Enable automatic reconnection
      reconnectionAttempts: 5,              // Try to reconnect 5 times
      reconnectionDelay: 1000,              // Start with 1s delay between reconnection attempts
      timeout: 20000                        // Increase timeout for slower mobile connections
    });
    setSocket(newSocket);

    newSocket.on('connect_error', (err: Error) => {
      setError(`Socket connection error: ${err.message}`);
      console.error('Socket connection error:', err);
    });

    newSocket.on('reconnect_attempt', (attemptNumber: number) => {
      console.log(`Attempting to reconnect: attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect', () => {
      console.log('Reconnected successfully');
      setError(null);
      // Re-establish settings after reconnection
      newSocket.emit('set-language', language);
      newSocket.emit('set-api-provider', apiProvider);
      newSocket.emit('toggle-rag', useRag);
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
      setConversationHistory((prev: { user: string; ai: string }[]) => [...prev, { user: data.transcription, ai: data.aiResponse }]);

      if (data.audioBuffer && audioRef.current) {
        try {
          const blob = new Blob([data.audioBuffer], { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(blob);
          audioRef.current.src = audioUrl;
          audioRef.current.play().catch((playError: Error) => {
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

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
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
            voiceName: voiceOptions[language as SupportedLanguage][voiceType as VoiceType],
            apiProvider,
            useRag
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

        {/* API Provider Selector */}
        <div className="mb-6">
          <label htmlFor="api-provider-select" className="block text-sm font-medium text-gray-700 mb-2">
            AI Provider
          </label>
          <select
            id="api-provider-select"
            value={apiProvider}
            onChange={handleApiProviderChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="gpt">OpenAI GPT</option>
            <option value="openrouter">OpenRouter (Free)</option>
            <option value="fireworks">Fireworks AI</option>
          </select>
        </div>

        {/* RAG Toggle Switch */}
        <div className="mb-6 flex items-center justify-between">
          <label htmlFor="rag-toggle" className="text-sm font-medium text-gray-700">
            Enable Gurbani Knowledge Base
          </label>
          <div className="relative inline-block w-12 mr-2 align-middle select-none">
            <input
              type="checkbox"
              id="rag-toggle"
              checked={useRag}
              onChange={handleRagToggle}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
            />
            <label
              htmlFor="rag-toggle"
              className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${useRag ? 'bg-blue-500' : 'bg-gray-300'}`}
            ></label>
          </div>
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

        {/* Transcription Display */}
        {transcription && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-semibold text-gray-500">You said:</h3>
              <button
                onClick={() => copyToClipboard(transcription)}
                className="text-gray-400 hover:text-gray-600"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-800">{transcription}</p>
          </div>
        )}

        {/* AI Response Display */}
        {aiResponse && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 relative">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-sm font-semibold text-blue-500">Response:</h3>
              <button
                onClick={() => copyToClipboard(aiResponse)}
                className="text-gray-400 hover:text-gray-600"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
                {showCopiedFeedback && (
                  <span className="absolute top-0 right-0 mt-8 mr-2 px-2 py-1 bg-gray-800 text-white text-xs rounded animate-fade-in-out">
                    Copied!
                  </span>
                )}
              </button>
            </div>
            <p className="text-gray-800 whitespace-pre-line">{aiResponse}</p>
          </div>
        )}

        {/* Audio Element (Hidden) */}
        <audio ref={audioRef} className="hidden" controls />

        {/* Conversation History */}
        {conversationHistory.length > 1 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Conversation History</h3>
            <div className="space-y-4 max-h-96 overflow-y-auto p-2">
              {conversationHistory.map((exchange, index) => (
                <div key={index} className="border-b border-gray-200 pb-3">
                  <div className="mb-2">
                    <span className="font-medium text-gray-600">You: </span>
                    <span>{exchange.user}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-600">Assistant: </span>
                    <span className="whitespace-pre-line">{exchange.ai}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage Statistics */}
        {usage && (
          <div className="mt-6 text-xs text-gray-500">
            <details>
              <summary className="cursor-pointer font-medium">Usage Statistics</summary>
              <div className="mt-2 space-y-1 pl-4">
                <p>Speech-to-Text: ${usage.speechToText.totalCost.toFixed(6)}</p>
                <p>AI Response: ${usage.chatGPT.totalCost.toFixed(6)}</p>
                <p>Text-to-Speech: ${usage.textToSpeech.totalCost.toFixed(6)}</p>
                <p className="font-semibold">Total Cost: ${usage.totalCost.toFixed(6)}</p>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* CSS for toggle switch */}
      <style jsx>{`
        .toggle-checkbox:checked {
          transform: translateX(100%);
          border-color: #3b82f6;
        }
        .toggle-label {
          transition: background-color 0.2s ease-in-out;
        }
        .animate-text {
          background-size: 200% 200%;
          animation: gradient 2s ease infinite;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        .animate-fade-in-out {
          animation: fadeInOut 2s ease-in-out;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}