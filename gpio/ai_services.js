const { SpeechClient } = require("@google-cloud/speech");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const OpenAI = require("openai");
const axios = require("axios");
const config = require("./config");

class AIServices {
  constructor() {
    if (config.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        this.speechClient = new SpeechClient();
        this.ttsClient = new TextToSpeechClient();
      } catch (error) {
        console.error("Error initializing Google Cloud clients:", error);
        this.speechClient = null;
        this.ttsClient = null;
      }
    } else {
      console.warn(
        "GOOGLE_APPLICATION_CREDENTIALS not set. Google Cloud services will be unavailable."
      );
      this.speechClient = null;
      this.ttsClient = null;
    }

    this.openai_api_key = config.OPENAI_API_KEY;
    this.openrouter_api_key = config.OPENROUTER_API_KEY;
    this.fireworks_api_key = config.FIREWORKS_API_KEY;

    if (this.openai_api_key && this.openai_api_key !== "YOUR_OPENAI_API_KEY") {
      this.openai = new OpenAI({ apiKey: this.openai_api_key });
    } else {
      this.openai = null;
    }
  }

  async speechToText(
    audio_content_wav,
    language_code = config.INPUT_LANGUAGE_CODE
  ) {
    if (!this.speechClient) {
      console.error(
        "Error: Google SpeechClient not initialized. Cannot perform Speech-to-Text."
      );
      return null;
    }
    if (!audio_content_wav) {
      console.error("Error: No audio content provided for STT.");
      return null;
    }

    try {
      const audio = {
        content: audio_content_wav.toString("base64"),
      };
      const recognizerConfig = {
        encoding: "LINEAR16",
        sampleRateHertz: config.AUDIO_SAMPLE_RATE,
        languageCode: language_code,
        enableAutomaticPunctuation: true,
      };
      const request = {
        audio: audio,
        config: recognizerConfig,
      };

      console.log(
        `Sending audio to Google STT with language: ${language_code}`
      );
      const [response] = await this.speechClient.recognize(request);

      if (
        response.results &&
        response.results.length > 0 &&
        response.results[0].alternatives &&
        response.results[0].alternatives.length > 0
      ) {
        const [
          {
            alternatives: [{ transcript }],
          },
        ] = response.results;
        console.log(`Transcription: ${transcript}`);
        return transcript;
      } else {
        console.log("No transcription results found.");
        return "";
      }
    } catch (e) {
      console.error(`Error during Speech-to-Text: ${e}`);
      return null;
    }
  }

  async textToSpeech(
    text,
    language_code = config.OUTPUT_LANGUAGE_CODE,
    voice_name = config.PUNJABI_VOICE_NAME
  ) {
    if (!this.ttsClient) {
      console.error(
        "Error: Google TextToSpeechClient not initialized. Cannot perform Text-to-Speech."
      );
      return null;
    }
    if (!text) {
      console.error("Error: No text provided for TTS.");
      return null;
    }

    try {
      const request = {
        input: { text: text },
        voice: { languageCode: language_code, name: voice_name },
        audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
      };

      console.log(
        `Synthesizing speech for text: '${text}' in language: ${language_code} with voice: ${voice_name}`
      );
      const [response] = await this.ttsClient.synthesizeSpeech(request);
      console.log("Speech synthesized successfully.");
      return response.audioContent;
    } catch (e) {
      console.error(`Error during Text-to-Speech: ${e}`);
      return null;
    }
  }

  async getAiResponse(
    prompt,
    model = config.DEFAULT_MODEL,
    conversation_history = []
  ) {
    const system_message =
      "You are a helpful assistant who responds in Punjabi. Keep your responses natural, conversational, and concise.";
    const messages = [
      { role: "system", content: system_message },
      ...conversation_history,
      { role: "user", content: prompt },
    ];

    console.log(
      `Getting AI response using model: ${model} for prompt: '${prompt}'`
    );

    try {
      if (model === "gpt") {
        if (!this.openai) {
          console.error(
            "Error: OpenAI API key not configured or client not initialized."
          );
          return "OpenAI API key not configured or client not initialized.";
        }
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini", // Or other desired OpenAI model
          messages: messages,
          max_tokens: 250,
          temperature: 0.7,
        });
        return response.choices[0].message.content.trim();
      } else if (model === "openrouter") {
        if (
          !this.openrouter_api_key ||
          this.openrouter_api_key === "YOUR_OPENROUTER_API_KEY"
        ) {
          console.error("Error: OpenRouter API key not configured.");
          return "OpenRouter API key not configured.";
        }
        const api_response = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "qwen/qwen-2-7b-instruct", // Example OpenRouter model
            messages: messages,
          },
          {
            headers: {
              Authorization: `Bearer ${this.openrouter_api_key}`,
              "Content-Type": "application/json",
            },
          }
        );
        return api_response.data.choices[0].message.content.trim();
      } else if (model === "fireworks") {
        if (
          !this.fireworks_api_key ||
          this.fireworks_api_key === "YOUR_FIREWORKS_API_KEY"
        ) {
          console.error("Error: Fireworks AI API key not configured.");
          return "Fireworks AI API key not configured.";
        }
        const api_response = await axios.post(
          "https://api.fireworks.ai/inference/v1/chat/completions",
          {
            model: "accounts/fireworks/models/qwen-72b-chat", // Example Fireworks model
            messages: messages,
            max_tokens: 250,
            temperature: 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${this.fireworks_api_key}`,
              "Content-Type": "application/json",
            },
          }
        );
        return api_response.data.choices[0].message.content.trim();
      } else {
        console.error(`Error: Unsupported AI model '${model}'`);
        return `Unsupported AI model: ${model}`;
      }
    } catch (e) {
      console.error(
        `API request error for ${model}: ${
          e.response ? e.response.data : e.message
        }`
      );
      return `Error communicating with ${model} API.`;
    }
  }
}

module.exports = AIServices;

// Example Usage (for testing this module directly)
async function testAIServices() {
  const aiService = new AIServices();

  // Test TTS (English for announcement)
  console.log("\n--- Testing TTS (English Announcement) ---");
  const english_text = "Switched to GPT model.";
  const english_audio = await aiService.textToSpeech(
    english_text,
    "en-US",
    config.ENGLISH_VOICE_NAME
  );
  if (english_audio) {
    console.log(
      `Generated English audio (${english_audio.length} bytes). You would play this with an audio player.`
    );
  } else {
    console.log("Failed to generate English audio.");
  }

  // Test AI Response (e.g., OpenRouter)
  console.log("\n--- Testing AI Response (OpenRouter) ---");
  if (
    config.OPENROUTER_API_KEY &&
    config.OPENROUTER_API_KEY !== "YOUR_OPENROUTER_API_KEY"
  ) {
    const punjabi_prompt = "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਤੁਹਾਡਾ ਕੀ ਹਾਲ ਹੈ?"; // Hello, how are you?
    const ai_reply = await aiService.getAiResponse(
      punjabi_prompt,
      "openrouter"
    );
    if (ai_reply && !ai_reply.startsWith("Error")) {
      console.log(`AI (OpenRouter) Response: ${ai_reply}`);

      // Test TTS (Punjabi for AI response)
      console.log("\n--- Testing TTS (Punjabi Response) ---");
      const punjabi_audio = await aiService.textToSpeech(
        ai_reply,
        config.OUTPUT_LANGUAGE_CODE,
        config.PUNJABI_VOICE_NAME
      );
      if (punjabi_audio) {
        console.log(
          `Generated Punjabi audio (${punjabi_audio.length} bytes) for AI response.`
        );
      } else {
        console.log("Failed to generate Punjabi audio for AI response.");
      }
    } else {
      console.log(
        `Failed to get AI response from OpenRouter or error occurred: ${ai_reply}`
      );
    }
  } else {
    console.log(
      "Skipping OpenRouter test as API key is not configured or is default."
    );
  }
  // Note: STT requires actual audio input, so it's harder to test in this standalone script without a recording mechanism.
  console.log("\n--- STT Test Information ---");
  console.log(
    "STT requires actual audio input. To test, you would pass a base64 encoded WAV audio string."
  );
}

if (require.main === module) {
  testAIServices().catch(console.error);
}
