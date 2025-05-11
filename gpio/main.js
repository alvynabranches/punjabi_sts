const config = require("./config");
const GpioHandler = require("./gpio_handler");
const AudioHandler = require("./audio_handler");
const AIServices = require("./ai_services");

class PunjabiPiApp {
  constructor() {
    this.aiServices = new AIServices();
    this.audioHandler = new AudioHandler();
    this.gpioHandler = new GpioHandler(
      this.handleRecordButtonPressed.bind(this),
      this.handleSwitchModelButtonPressed.bind(this),
      this.handleSwitchVoiceButtonPressed.bind(this) // Add the new callback
    );

    this.isInteracting = false; // To prevent concurrent interactions
    this.currentModel = config.DEFAULT_MODEL;
    this.availableModels = ["gpt", "openrouter", "fireworks"]; // Cycle through these
    this.currentPunjabiVoiceIndex = 0;
    this.punjabiVoiceNames = config.PUNJABI_VOICE_NAMES;
    this.currentPunjabiVoice =
      this.punjabiVoiceNames[this.currentPunjabiVoiceIndex];
    this.conversationHistory = [];

    console.log(
      `Punjabi Pi App initialized. Current AI Model: ${this.currentModel}, Current Punjabi Voice: ${this.currentPunjabiVoice}`
    );
    this.gpioHandler.setStatusLed(true); // App is running
    this.announceMessage(
      `Welcome! Current model is ${this.currentModel}. Current Punjabi voice is ${this.currentPunjabiVoice}.`,
      "en-US",
      config.ENGLISH_VOICE_NAME
    );
  }

  async announceMessage(
    text,
    languageCode = config.OUTPUT_LANGUAGE_CODE,
    voiceName
  ) {
    // If no specific voiceName is provided, use the current Punjabi voice for Punjabi output, or English voice for English output.
    if (!voiceName) {
      if (languageCode === config.OUTPUT_LANGUAGE_CODE) {
        voiceName = this.currentPunjabiVoice;
      } else {
        voiceName = config.ENGLISH_VOICE_NAME;
      }
    }
    try {
      const audioContent = await this.aiServices.textToSpeech(
        text,
        languageCode,
        voiceName
      );
      if (audioContent) {
        this.audioHandler.playAudioMp3(audioContent);
      } else {
        console.error("Failed to generate announcement audio.");
      }
    } catch (error) {
      console.error("Error during announcement:", error);
    }
  }

  async handleRecordButtonPressed() {
    if (this.isInteracting) {
      console.warn("Interaction already in progress. Button press ignored.");
      return;
    }
    if (this.audioHandler.isRecording) {
      console.log("Stopping current recording via button press.");
      const audioDataWav = await this.audioHandler.stopRecording();
      this.gpioHandler.setActiveLed(false);
      if (audioDataWav) {
        await this.processAudio(audioDataWav);
      }
      return;
    }

    this.isInteracting = true;
    this.gpioHandler.setActiveLed(true);
    console.log("Record button pressed. Starting interaction.");

    this.audioHandler.startRecording();

    // The recording will stop based on silence or duration limit in AudioHandler
    // We need a way for AudioHandler to notify us when recording is done, or poll/wait.
    // For now, let's assume stopRecording will be called externally or by timeout.
    // A more robust solution would involve event emitters or callbacks from AudioHandler.

    // Simulate waiting for recording to finish (or be stopped by silence/duration)
    // This part needs to be more robust, perhaps using a promise from startRecording
    // that resolves when recording is complete.
    const checkRecordingInterval = setInterval(async () => {
      if (!this.audioHandler.isRecording) {
        clearInterval(checkRecordingInterval);
        this.gpioHandler.setActiveLed(false);
        console.log("Recording stopped (likely by silence/duration).");
        const audioDataWav = await this.audioHandler.stopRecording(); // Ensure it's stopped and get data
        if (audioDataWav) {
          await this.processAudio(audioDataWav);
        } else {
          console.log("No audio data received after recording stopped.");
          this.isInteracting = false;
        }
      }
    }, 500); // Check every 500ms
  }

  async processAudio(audioDataWav) {
    console.log("Processing recorded audio...");
    try {
      const transcript = await this.aiServices.speechToText(
        audioDataWav,
        config.INPUT_LANGUAGE_CODE
      );
      if (transcript) {
        console.log(`User said: ${transcript}`);
        this.conversationHistory.push({ role: "user", content: transcript });

        const aiResponseText = await this.aiServices.getAiResponse(
          transcript,
          this.currentModel,
          this.conversationHistory
        );
        if (aiResponseText) {
          console.log(`AI responded: ${aiResponseText}`);
          this.conversationHistory.push({
            role: "assistant",
            content: aiResponseText,
          });
          // Keep conversation history from growing too large
          if (this.conversationHistory.length > 10) {
            // Max 5 pairs
            this.conversationHistory = this.conversationHistory.slice(-10);
          }
          await this.announceMessage(aiResponseText);
        } else {
          console.error("Failed to get AI response.");
          await this.announceMessage(
            "Sorry, I could not process that.",
            "en-US",
            config.ENGLISH_VOICE_NAME
          );
          this.audioHandler.playFeedbackSound("error");
        }
      } else if (transcript === "") {
        console.log("No speech detected or STT returned empty.");
        await this.announceMessage(
          "I did not catch that, please try again.",
          "en-US",
          config.ENGLISH_VOICE_NAME
        );
      } else {
        console.error("Failed to get transcript from STT.");
        await this.announceMessage(
          "Sorry, there was an error understanding you.",
          "en-US",
          config.ENGLISH_VOICE_NAME
        );
        this.audioHandler.playFeedbackSound("error");
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      await this.announceMessage(
        "An unexpected error occurred.",
        "en-US",
        config.ENGLISH_VOICE_NAME
      );
      this.audioHandler.playFeedbackSound("error");
    } finally {
      this.isInteracting = false;
      this.gpioHandler.setActiveLed(false);
      console.log("Interaction finished.");
    }
  }

  handleSwitchModelButtonPressed() {
    if (this.isInteracting) {
      console.warn("Cannot switch model during an interaction.");
      this.audioHandler.playFeedbackSound("error");
      return;
    }
    const currentIndex = this.availableModels.indexOf(this.currentModel);
    const nextIndex = (currentIndex + 1) % this.availableModels.length;
    this.currentModel = this.availableModels[nextIndex];
    this.conversationHistory = []; // Reset conversation history on model switch
    console.log(`Switched AI Model to: ${this.currentModel}`);
    this.announceMessage(
      `Switched to ${this.currentModel} model.`,
      "en-US",
      config.ENGLISH_VOICE_NAME
    );
  }

  handleSwitchVoiceButtonPressed() {
    if (this.isInteracting) {
      console.warn("Cannot switch voice during an interaction.");
      this.audioHandler.playFeedbackSound("error");
      return;
    }
    this.currentPunjabiVoiceIndex =
      (this.currentPunjabiVoiceIndex + 1) % this.punjabiVoiceNames.length;
    this.currentPunjabiVoice =
      this.punjabiVoiceNames[this.currentPunjabiVoiceIndex];
    console.log(`Switched Punjabi Voice to: ${this.currentPunjabiVoice}`);
    this.announceMessage(
      `Switched to Punjabi voice ${this.currentPunjabiVoice}.`,
      "en-US",
      config.ENGLISH_VOICE_NAME
    );
  }

  cleanup() {
    console.log("Shutting down Punjabi Pi App...");
    this.gpioHandler.cleanup();
    this.audioHandler.cleanup();
    this.gpioHandler.setStatusLed(false);
    console.log("Cleanup complete. Exiting.");
    process.exit(0);
  }
}

// Main execution
if (require.main === module) {
  const app = new PunjabiPiApp();

  // Graceful shutdown
  process.on("SIGINT", () => app.cleanup());
  process.on("SIGTERM", () => app.cleanup());

  console.log("Application running. Press Ctrl+C to exit.");
  // Keep the process alive, GPIO events will trigger actions.
  // If not using GPIO or for testing in environments without it,
  // you might need a different way to keep it alive or trigger actions.
}

module.exports = PunjabiPiApp; // Export for potential testing
