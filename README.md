# Speech to Speech Assistant

## Software Architecture
- The frontend is developed using Next.js with TypeScript
- The backend is developed using Nest.js with TypeScript

## APIs Used
- Uses Google Speech to Text for speech recognition
- Multiple AI providers for text generation:
  - OpenAI GPT (paid service)
  - OpenRouter (free service)
  - Fireworks AI (paid service: $0.22/M input tokens, $0.88/M output tokens)
- Uses Google Text to Speech to give audio output

## Features
- Support for multiple languages (English, Hindi, Punjabi, Marathi)
- Voice customization (standard, neural, wavenet voices)
- Speaking rate and pitch adjustment
- Multiple AI provider options

## .env File
OPENAI_API_KEY=
OPENROUTER_API_KEY=
FIREWORKS_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS="/app/google-cloud.json"
GOOGLE_PROJECT_ID=

- Generate the google-cloud.json using service account and rename the file.

## Usage
1. Select your preferred language from the dropdown menu
2. Choose an AI provider (OpenAI GPT, OpenRouter, or Fireworks)
3. Select a voice type
4. Adjust speaking rate and pitch if needed
5. Click the microphone button to start recording
6. Speak your message
7. Click the stop button to end recording
8. The application will transcribe your speech, generate an AI response, and read it back to you
