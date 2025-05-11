# Punjabi Pi GPIO Application (Node.js Version)

This project is a Raspberry Pi-based application that uses GPIO pins for button input and LED feedback to interact with AI services for speech-to-text, language model responses, and text-to-speech, primarily in Punjabi.

This version is implemented in Node.js.

## Features

- **Button-triggered Recording:** Press a button to start audio recording.
- **Automatic Silence Detection:** Recording stops automatically after a period of silence.
- **Speech-to-Text (STT):** Converts recorded Punjabi speech to text using Google Cloud Speech-to-Text.
- **AI Chat Completion:** Sends the transcribed text to an AI model (OpenAI GPT, OpenRouter, or Fireworks AI) to get a response.
- **Text-to-Speech (TTS):** Converts the AI's text response back into Punjabi speech using Google Cloud Text-to-Speech.
- **Model Switching:** Press a button to cycle through configured AI models.
- **Voice Switching:** Press a third button to cycle through available Punjabi voices for Text-to-Speech.
- **LED Feedback:** LEDs indicate application status (running, recording, error).
- **Configurable:** API keys, language settings, GPIO pins, and audio parameters can be configured via a `.env` file.

## Prerequisites

- Raspberry Pi (tested on Raspberry Pi 4 Model B, but should work on others with GPIO).
- Node.js and npm installed on the Raspberry Pi.
- Microphone and speaker connected to the Raspberry Pi.
- Google Cloud Platform account with Speech-to-Text and Text-to-Speech APIs enabled.
- API keys for the desired AI services (OpenAI, OpenRouter, Fireworks AI).
- `arecord` utility (usually part of `alsa-utils` package on Raspberry Pi OS) for audio recording. Install if missing: `sudo apt-get update && sudo apt-get install alsa-utils -y`

## Hardware Setup

Connect the following components to your Raspberry Pi's GPIO pins (BCM numbering by default, configurable in `.env`):

- **Record Button:** Connect a momentary push button between the configured `BUTTON_PIN_RECORD` and Ground.
- **Switch Model Button:** Connect a momentary push button between the configured `BUTTON_PIN_SWITCH_MODEL` and Ground.
- **Status LED:** Connect an LED (with an appropriate resistor) between `LED_PIN_STATUS` and Ground.
- **Active/Recording LED:** Connect an LED (with an appropriate resistor) between `LED_PIN_ACTIVE` and Ground.

Refer to the `config.js` file for default pin numbers and `.env.example` for how to override them.

## Software Setup

1.  **Clone the Repository (if applicable) or copy files to your Raspberry Pi.**

2.  **Navigate to the project directory:**

    ```bash
    cd /path/to/punjabi_ws/gpio
    ```

3.  **Create and Configure Environment Variables:**
    Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

    Edit the `.env` file with your specific configurations:

    - `GOOGLE_APPLICATION_CREDENTIALS`: Path to your Google Cloud service account JSON key file.
    - `OPENAI_API_KEY`: Your OpenAI API key.
    - `OPENROUTER_API_KEY`: Your OpenRouter API key.
    - `FIREWORKS_API_KEY`: Your Fireworks AI API key.
    - Audio device names, GPIO pins, language codes, etc., as needed. Refer to comments in `.env.example` or `config.js`.

4.  **Install Dependencies:**

    ```bash
    npm install
    ```

5.  **Ensure Google Cloud Authentication:**
    Make sure the `GOOGLE_APPLICATION_CREDENTIALS` environment variable points to a valid service account key JSON file that has permissions for Google Speech-to-Text and Text-to-Speech APIs.
    You might need to set this globally or ensure it's available to the Node.js process.
    Example: `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"` in your shell profile or before running the app.

## Running the Application

To start the application:

```bash
npm start
```

Or directly using Node:

```bash
node main.js
```

## Running with Startup Script (Recommended for continuous operation)

This project includes a `startup.sh` script designed to keep the application running continuously. It also attempts to update the code from GitHub and reinstall dependencies if an internet connection is available before starting the application.

To use the startup script:

1.  **Make it executable (if you haven't already):**
    ```bash
    chmod +x startup.sh
    ```

2.  **Run the script:**
    ```bash
    ./startup.sh
    ```

The script will handle:
- Checking for internet.
- Pulling latest code from Git (if internet is available).
- Installing/updating npm dependencies (if internet is available and code was pulled).
- Running `main.js` in a loop, so if it crashes, it will restart automatically after 5 seconds.

The application will initialize, and the status LED should turn on. You can then use the buttons to interact with the system.

## How it Works

1.  **Initialization:**

    - Loads configuration from `.env` and `config.js`.
    - Initializes GPIO pins for buttons and LEDs.
    - Initializes AI services (Google Cloud STT/TTS, LLM clients).
    - Initializes audio recording and playback handlers.
    - Announces the current AI model.

2.  **Record Button Press:**

    - The active LED turns on.
    - A start sound effect plays (if configured).
    - The system starts recording audio from the microphone.
    - Recording stops automatically after a configurable duration of silence or a maximum recording time.
    - An end sound effect plays (if configured).
    - The active LED turns off.

3.  **Audio Processing:**

    - The recorded WAV audio is sent to Google Cloud Speech-to-Text to get a Punjabi transcript.

4.  **AI Interaction:**

    - The transcript is sent as a prompt to the currently selected AI model (e.g., GPT-4o-mini via OpenAI, or models via OpenRouter/Fireworks AI).
    - The AI model generates a response in Punjabi.

5.  **Response Playback:**

    - The AI's text response is sent to Google Cloud Text-to-Speech to generate Punjabi audio (MP3).
    - The generated audio is played back through the speaker.

6.  **Switch Model Button Press:**

    - Cycles to the next available AI model (e.g., GPT -> OpenRouter -> Fireworks -> GPT).
    - Announces the newly selected model in English.
    - Clears the conversation history.

7.  **Switch Voice Button Press:**
    - Cycles to the next available Punjabi voice name for TTS (e.g., pa-IN-Standard-A -> pa-IN-Standard-B).
    - Announces the newly selected voice in English.

## Files

- `main.js`: Main application logic, orchestrates other modules.
- `gpio_handler.js`: Handles GPIO interactions (buttons, LEDs) using the `onoff` library.
- `audio_handler.js`: Manages audio recording (using `node-record-lpcm16`) and playback (using `play-sound`).
- `ai_services.js`: Interfaces with Google Cloud STT/TTS, OpenAI, OpenRouter, and Fireworks AI.
- `config.js`: Loads and provides application configuration (default values, reads from `.env`).
- `package.json`: Node.js project manifest, lists dependencies.
- `.env.example`: Template for environment variables.
- `README.md`: This file.

## Troubleshooting

- **GPIO Errors:** Ensure you are running the script on a Raspberry Pi with `sudo` if needed, or that your user has GPIO access permissions. Check pin connections.
- **Audio Errors (`arecord`):** Make sure `arecord` is installed (`sudo apt-get install alsa-utils`). Check your microphone setup using `arecord -l` and `alsamixer`. Ensure the `AUDIO_DEVICE_NAME` in `.env` is correct (e.g., `plughw:1,0`).
- **Google Cloud Errors:** Verify `GOOGLE_APPLICATION_CREDENTIALS` path and API permissions. Check your internet connection.
- **API Key Errors:** Ensure your API keys in `.env` are correct and have not expired or hit rate limits.
- **No Sound/Recording:** Check speaker/microphone connections and ALSA volume levels (`alsamixer`).

## Dependencies

Key Node.js packages used:

- `@google-cloud/speech`: Google Cloud Speech-to-Text client.
- `@google-cloud/text-to-speech`: Google Cloud Text-to-Speech client.
- `axios`: For making HTTP requests to OpenRouter/Fireworks AI.
- `dotenv`: Loads environment variables from a `.env` file.
- `openai`: OpenAI API client.
- `onoff`: GPIO access and interrupt detection.
- `node-record-lpcm16`: Audio recording.
- `play-sound`: Audio playback.

Refer to `package.json` for a full list of dependencies.
