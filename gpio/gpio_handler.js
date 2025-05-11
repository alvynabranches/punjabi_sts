const { Gpio } = require("onoff");
const config = require("./config");

class GpioHandler {
  constructor(recordCallback, switchModelCallback, switchVoiceCallback) {
    this.recordCallback = recordCallback;
    this.switchModelCallback = switchModelCallback;
    this.switchVoiceCallback = switchVoiceCallback;

    // Initialize GPIO pins
    try {
      this.buttonRecord = new Gpio(config.BUTTON_PIN_RECORD, "in", "falling", {
        debounceTimeout: config.DEBOUNCE_TIME_MS,
        activeLow: true,
      });
      this.buttonSwitchModel = new Gpio(
        config.BUTTON_PIN_SWITCH_MODEL,
        "in",
        "falling",
        {
          debounceTimeout: config.DEBOUNCE_TIME_MS,
          activeLow: true,
        }
      );
      this.buttonSwitchVoice = new Gpio(
        config.BUTTON_PIN_SWITCH_VOICE,
        "in",
        "falling",
        {
          debounceTimeout: config.DEBOUNCE_TIME_MS,
          activeLow: true,
        }
      );
      this.ledStatus = new Gpio(config.LED_PIN_STATUS, "out");
      this.ledActive = new Gpio(config.LED_PIN_ACTIVE, "out");

      // Set initial LED states
      this.ledStatus.writeSync(1); // Turn status LED on (indicates app is running)
      this.ledActive.writeSync(0); // Turn active LED off

      // Watch for button presses
      this.buttonRecord.watch((err, value) => {
        if (err) {
          console.error("Error watching record button:", err);
          return;
        }
        if (value === 0) {
          // Button pressed (falling edge for activeLow)
          console.log("Record button pressed.");
          if (this.recordCallback) {
            this.recordCallback();
          }
        }
      });

      this.buttonSwitchModel.watch((err, value) => {
        if (err) {
          console.error("Error watching switch model button:", err);
          return;
        }
        if (value === 0) {
          // Button pressed
          console.log("Switch model button pressed.");
          if (this.switchModelCallback) {
            this.switchModelCallback();
          }
        }
      });

      this.buttonSwitchVoice.watch((err, value) => {
        if (err) {
          console.error("Error watching switch voice button:", err);
          return;
        }
        if (value === 0) {
          // Button pressed
          console.log("Switch voice button pressed.");
          if (this.switchVoiceCallback) {
            this.switchVoiceCallback();
          }
        }
      });

      console.log("GPIO Handler initialized. Watching buttons.");
    } catch (error) {
      console.error(
        "Failed to initialize GPIO. Are you running on a Raspberry Pi with necessary permissions? Error:",
        error
      );
      console.warn("GPIO functionality will be disabled.");
      // Mock GPIOs if not on RPi or error for development purposes
      this.buttonRecord = { watch: () => {}, unexport: () => {} };
      this.buttonSwitchModel = { watch: () => {}, unexport: () => {} };
      this.buttonSwitchVoice = { watch: () => {}, unexport: () => {} };
      this.ledStatus = {
        writeSync: (val) => console.log(`Mock LED Status: ${val}`),
        unexport: () => {},
      };
      this.ledActive = {
        writeSync: (val) => console.log(`Mock LED Active: ${val}`),
        unexport: () => {},
      };
    }
  }

  setStatusLed(state) {
    try {
      this.ledStatus.writeSync(state ? 1 : 0);
      console.log(`Status LED set to ${state ? "ON" : "OFF"}`);
    } catch (error) {
      console.error("Error setting status LED:", error);
    }
  }

  setActiveLed(state) {
    try {
      this.ledActive.writeSync(state ? 1 : 0);
      console.log(`Active LED set to ${state ? "ON" : "OFF"}`);
    } catch (error) {
      console.error("Error setting active LED:", error);
    }
  }

  cleanup() {
    console.log("Cleaning up GPIO...");
    try {
      this.ledStatus.writeSync(0);
      this.ledActive.writeSync(0);
      this.buttonRecord.unexport();
      this.buttonSwitchModel.unexport();
      this.buttonSwitchVoice.unexport();
      this.ledStatus.unexport();
      this.ledActive.unexport();
      console.log("GPIO cleanup successful.");
    } catch (error) {
      console.error("Error during GPIO cleanup:", error);
    }
  }
}

module.exports = GpioHandler;

// Example Usage (for testing this module directly - requires running on RPi)
if (require.main === module) {
  console.log("Testing GPIO Handler...");
  console.log(`Using Record Button Pin: ${config.BUTTON_PIN_RECORD}`);
  console.log(
    `Using Switch Model Button Pin: ${config.BUTTON_PIN_SWITCH_MODEL}`
  );
  console.log(`Using Status LED Pin: ${config.LED_PIN_STATUS}`);
  console.log(`Using Active LED Pin: ${config.LED_PIN_ACTIVE}`);

  const mockRecordCallback = () => {
    console.log("Mock Record Callback Triggered!");
    gpioHandler.setActiveLed(true);
    setTimeout(() => gpioHandler.setActiveLed(false), 2000);
  };

  const mockSwitchModelCallback = () => {
    console.log("Mock Switch Model Callback Triggered!");
    // Simulate model switch indication
    gpioHandler.setStatusLed(false);
    setTimeout(() => gpioHandler.setStatusLed(true), 500);
  };

  const gpioHandler = new GpioHandler(
    mockRecordCallback,
    mockSwitchModelCallback
  );

  // Keep the script running to listen for button presses
  console.log("Press Ctrl+C to exit test.");

  process.on("SIGINT", () => {
    gpioHandler.cleanup();
    process.exit(0);
  });

  // Simulate LED blinking for status
  let statusToggle = true;
  setInterval(() => {
    // gpioHandler.setStatusLed(statusToggle);
    // statusToggle = !statusToggle;
  }, 3000); // Don't blink status by default, keep it on
}
