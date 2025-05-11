const record = require("node-record-lpcm16");
const player = require("play-sound")((opts = {}));
const fs = require("fs");
const path = require("path");
const { Writable } = require("stream");
const config = require("./config");

class AudioHandler {
  constructor() {
    this.isRecording = false;
    this.recording = null;
    this.audioFilePath = path.join(__dirname, "temp_recording.wav"); // Temporary file to store recording
  }

  playFeedbackSound(soundType) {
    let soundFile;
    switch (soundType) {
      case "start":
        soundFile = config.SOUND_EFFECT_START;
        break;
      case "end":
        soundFile = config.SOUND_EFFECT_END;
        break;
      case "error":
        soundFile = config.SOUND_EFFECT_ERROR;
        break;
      default:
        console.warn(`Unknown sound type: ${soundType}`);
        return;
    }

    if (
      soundFile &&
      soundFile !== "path/to/your/start_sound.mp3" &&
      soundFile !== "path/to/your/end_sound.mp3" &&
      soundFile !== "path/to/your/error_sound.mp3"
    ) {
      if (fs.existsSync(soundFile)) {
        player.play(soundFile, (err) => {
          if (err) {
            console.error(`Error playing sound ${soundFile}:`, err);
          }
        });
      } else {
        console.warn(`Sound file not found: ${soundFile}`);
      }
    } else {
      console.log(
        `Sound effect for '${soundType}' not configured or is default path.`
      );
    }
  }

  playAudioMp3(mp3Buffer) {
    if (!mp3Buffer || mp3Buffer.length === 0) {
      console.error("No MP3 buffer provided to play.");
      return;
    }
    const tempMp3Path = path.join(__dirname, "temp_playback.mp3");
    fs.writeFileSync(tempMp3Path, mp3Buffer);

    player.play(tempMp3Path, (err) => {
      if (err) {
        console.error("Error playing MP3 audio:", err);
      }
      // Clean up the temporary MP3 file
      fs.unlink(tempMp3Path, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting temporary MP3 file:", unlinkErr);
        }
      });
    });
  }

  startRecording(onStopCallback) {
    if (this.isRecording) {
      console.warn("Recording is already in progress.");
      return false;
    }

    console.log("Starting recording...");
    this.playFeedbackSound("start");
    this.isRecording = true;

    const fileStream = fs.createWriteStream(this.audioFilePath, {
      encoding: "binary",
    });

    this.recording = record.record({
      sampleRate: config.AUDIO_SAMPLE_RATE,
      channels: config.AUDIO_CHANNELS,
      threshold: config.SILENCE_THRESHOLD_RMS, // Silence threshold (0 means no silence detection)
      endOnSilence: true,
      silence: `${config.SILENCE_DURATION_SECONDS}s`, // Seconds of silence to end recording
      recorder: "arecord", // or 'sox', 'rec' based on your system and preference
      device: config.AUDIO_DEVICE_NAME, // e.g., 'plughw:1,0' or null for default
      audioType: "wav",
    });

    this.recording
      .stream()
      .on("error", (err) => {
        console.error("Recorder error:", err);
        this.isRecording = false;
        this.playFeedbackSound("error");
        if (onStopCallback) {
          onStopCallback(null, err);
        }
      })
      .pipe(fileStream);

    // Handle timeout for recording duration
    setTimeout(() => {
      if (this.isRecording) {
        console.log("Recording duration limit reached.");
        this.stopRecording();
      }
    }, config.RECORDING_DURATION_SECONDS * 1000);

    // The 'endOnSilence' should handle stopping, but this is a fallback
    // or if you want to manually stop after a certain duration regardless of silence.
    // The actual stop and callback will be triggered by stopRecording()

    console.log(
      `Recording to ${this.audioFilePath}. Will stop after ${config.RECORDING_DURATION_SECONDS}s or ${config.SILENCE_DURATION_SECONDS}s of silence.`
    );
    return true;
  }

  async stopRecording() {
    if (!this.isRecording || !this.recording) {
      console.warn("Recording is not in progress or recording object is null.");
      return null;
    }

    console.log("Stopping recording...");
    this.recording.stop();
    this.isRecording = false;
    this.playFeedbackSound("end");

    // It might take a moment for the file stream to close and write completely.
    // A small delay or a promise-based approach for stream finish might be needed for robustness.
    return new Promise((resolve, reject) => {
      // Wait a bit for file to be written, then read it.
      // This is a common pattern but can be made more robust with stream 'finish' events.
      setTimeout(() => {
        fs.readFile(this.audioFilePath, (err, data) => {
          if (err) {
            console.error("Error reading recorded audio file:", err);
            reject(err);
            return;
          }
          console.log(`Recorded audio data retrieved (${data.length} bytes).`);
          // Optionally delete the temp file after reading
          // fs.unlink(this.audioFilePath, unlinkErr => {
          //     if (unlinkErr) console.error('Error deleting temp recording file:', unlinkErr);
          // });
          resolve(data);
        });
      }, 200); // Adjust delay as needed
    });
  }

  cleanup() {
    // This method might be used if temporary files aren't cleaned up immediately
    // For now, temp_recording.wav is overwritten, and temp_playback.mp3 is deleted after playing.
    console.log("AudioHandler cleanup called.");
    try {
      if (fs.existsSync(this.audioFilePath)) {
        fs.unlinkSync(this.audioFilePath);
        console.log(`Deleted temporary recording file: ${this.audioFilePath}`);
      }
    } catch (err) {
      console.error("Error during cleanup:", err);
    }
  }
}

module.exports = AudioHandler;

// Example Usage (for testing this module directly)
async function testAudioHandler() {
  const audioHandler = new AudioHandler();

  console.log("--- Testing Audio Recording (5 seconds) ---");
  audioHandler.startRecording();

  // Simulate a delay for recording
  await new Promise((resolve) =>
    setTimeout(resolve, config.RECORDING_DURATION_SECONDS * 1000 + 500)
  );
  // Add a little extra time for stopRecording to complete if it was triggered by timeout

  if (!audioHandler.isRecording) {
    // Check if recording stopped (either by timeout or silence)
    const audioData = await audioHandler.stopRecording(); // This might be redundant if already stopped
    if (audioData) {
      console.log(`Recording finished. Audio data length: ${audioData.length}`);
      // Here you would typically send audioData to STT service
      // For testing playback, let's assume we have some MP3 data (e.g., from TTS)
      // const dummyMp3 = Buffer.from('simulated mp3 data'); // Replace with actual MP3 data for real test
      // audioHandler.playAudioMp3(dummyMp3);
    } else {
      console.log(
        "No audio data captured or recording failed to stop properly."
      );
    }
  } else {
    console.log("Recording did not stop as expected. Forcing stop.");
    const audioData = await audioHandler.stopRecording();
    if (audioData) {
      console.log(`Forced stop. Audio data length: ${audioData.length}`);
    }
  }

  audioHandler.cleanup();
}

if (require.main === module) {
  console.log(
    "Make sure you have `arecord` (or your chosen recorder) installed and configured."
  );
  console.log(`Using audio device: ${config.AUDIO_DEVICE_NAME || "default"}`);
  console.log(
    `Recording for ${config.RECORDING_DURATION_SECONDS} seconds or until ${config.SILENCE_DURATION_SECONDS}s of silence.`
  );
  console.log(
    "Please speak into the microphone if you want to record something."
  );
  console.log(
    "If you see errors, check your microphone setup and `arecord` installation."
  );
  testAudioHandler().catch(console.error);
}
