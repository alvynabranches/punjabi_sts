require("dotenv").config();

module.exports = {
  // --- Google Cloud Credentials ---
  GOOGLE_APPLICATION_CREDENTIALS:
    process.env.GOOGLE_APPLICATION_CREDENTIALS || "", // Path to your Google Cloud credentials JSON file

  // --- Audio Settings ---
  AUDIO_DEVICE_NAME: process.env.AUDIO_DEVICE_NAME || "plughw:1,0", // Specific microphone, use `arecord -L` to find yours
  AUDIO_SAMPLE_RATE: parseInt(process.env.AUDIO_SAMPLE_RATE) || 16000, // Sample rate for recording and STT
  AUDIO_CHANNELS: parseInt(process.env.AUDIO_CHANNELS) || 1, // Mono audio
  RECORDING_DURATION_SECONDS:
    parseInt(process.env.RECORDING_DURATION_SECONDS) || 5, // Max recording duration
  SILENCE_THRESHOLD_RMS: parseFloat(process.env.SILENCE_THRESHOLD_RMS) || 0.01, // RMS level to detect silence
  SILENCE_DURATION_SECONDS:
    parseFloat(process.env.SILENCE_DURATION_SECONDS) || 1.5, // How long silence should last to stop recording
  SOUND_EFFECT_START:
    process.env.SOUND_EFFECT_START || "path/to/your/start_sound.mp3", // Sound to play when recording starts
  SOUND_EFFECT_END:
    process.env.SOUND_EFFECT_END || "path/to/your/end_sound.mp3", // Sound to play when recording ends
  SOUND_EFFECT_ERROR:
    process.env.SOUND_EFFECT_ERROR || "path/to/your/error_sound.mp3", // Sound to play on error

  // --- Language and Voice Settings ---
  INPUT_LANGUAGE_CODE: process.env.INPUT_LANGUAGE_CODE || "pa-IN", // BCP-47 language code for Speech-to-Text (Punjabi, India)
  OUTPUT_LANGUAGE_CODE: process.env.OUTPUT_LANGUAGE_CODE || "pa-IN", // BCP-47 language code for Text-to-Speech (Punjabi, India)
  PUNJABI_VOICE_NAME: process.env.PUNJABI_VOICE_NAME || "pa-IN-Standard-A", // Default Punjabi voice name for TTS
  PUNJABI_VOICE_NAMES: process.env.PUNJABI_VOICE_NAMES
    ? process.env.PUNJABI_VOICE_NAMES.split(",")
    : [
        "pa-IN-Standard-A",
        "pa-IN-Standard-B",
        "pa-IN-Standard-C",
        "pa-IN-Wavenet-A",
        "pa-IN-Wavenet-B",
        "pa-IN-Wavenet-C",
      ], // List of Punjabi voice names for TTS
  ENGLISH_VOICE_NAME: process.env.ENGLISH_VOICE_NAME || "en-US-Standard-C", // English voice for announcements

  // --- AI Model Configuration ---
  DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gpt", // 'gpt', 'openrouter', or 'fireworks'
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "YOUR_OPENAI_API_KEY",
  OPENROUTER_API_KEY:
    process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_API_KEY",
  FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY || "YOUR_FIREWORKS_API_KEY",

  // --- GPIO Pin Configuration (using BCM numbering) ---
  BUTTON_PIN_RECORD: parseInt(process.env.BUTTON_PIN_RECORD) || 17, // GPIO pin for the record button
  BUTTON_PIN_SWITCH_MODEL: parseInt(process.env.BUTTON_PIN_SWITCH_MODEL) || 27, // GPIO pin for switching AI models
  BUTTON_PIN_SWITCH_VOICE: parseInt(process.env.BUTTON_PIN_SWITCH_VOICE) || 24, // GPIO pin for switching Punjabi voice
  LED_PIN_STATUS: parseInt(process.env.LED_PIN_STATUS) || 22, // GPIO pin for the status LED
  LED_PIN_ACTIVE: parseInt(process.env.LED_PIN_ACTIVE) || 23, // GPIO pin for the active/recording LED

  // --- Debounce Settings ---
  DEBOUNCE_TIME_MS: parseInt(process.env.DEBOUNCE_TIME_MS) || 200, // Debounce time for button presses in milliseconds

  // --- Logging ---
  LOG_LEVEL: process.env.LOG_LEVEL || "info", // 'debug', 'info', 'warn', 'error'
};
