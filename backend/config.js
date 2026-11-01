const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env")
});

function required(name, { allowEmpty = false } = {}) {
  const value = process.env[name];

  if (
    value === undefined ||
    (!allowEmpty && value.trim() === "")
  ) {
    throw new Error(
      `Missing ${name}. Copy backend/.env.example to backend/.env and fill it in.`
    );
  }

  return value;
}

function positiveInteger(name, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(required(name));

  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > max
  ) {
    throw new Error(
      `${name} must be an integer between 1 and ${max}.`
    );
  }

  return value;
}

function directory(name) {
  // Relative configured directories are resolved from backend/.
  return path.resolve(__dirname, required(name));
}

function serviceUrl(name) {
  const value = required(name);
  const parsed = new URL(value);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(
      `${name} must be an HTTP or HTTPS URL.`
    );
  }

  return value.replace(/\/+$/, "");
}

module.exports = {
  port: positiveInteger("PORT", 65535),

  db: {
    host: required("DB_HOST"),
    port: positiveInteger("DB_PORT", 65535),
    user: required("DB_USER"),
    password: required("DB_PASSWORD", {
      allowEmpty: true
    }),
    database: required("DB_NAME")
  },

  // External credentials are checked when their service is used.
  get sonarUrl() {
    return serviceUrl("SONAR_URL");
  },

  get sonarToken() {
    return required("SONAR_TOKEN");
  },

  get scannerHome() {
    const value = process.env.SONAR_SCANNER_HOME?.trim();

    // Empty or unset means the scanner is resolved from PATH.
    return value
      ? path.resolve(__dirname, value)
      : null;
  },

  get allincodeBaseUrl() {
    return serviceUrl("ALLINCODE_BASE_URL");
  },

  get allincodeEmail() {
    return required("ALLINCODE_EMAIL");
  },

  get allincodePassword() {
    return required("ALLINCODE_PASSWORD");
  },

  allincodePollIntervalMs: positiveInteger("ALLINCODE_POLL_INTERVAL_MS"),
allincodeAnalysisTimeoutMs: positiveInteger("ALLINCODE_ANALYSIS_TIMEOUT_MS"),
allincodeStepStallTimeoutMs: positiveInteger("ALLINCODE_STEP_STALL_TIMEOUT_MS"),

  sonarPollIntervalMs: positiveInteger(
    "SONAR_POLL_INTERVAL_MS"
  ),

  sonarAnalysisTimeoutMs: positiveInteger(
    "SONAR_ANALYSIS_TIMEOUT_MS"
  ),

  pythonCommand: required("PYTHON_CMD"),
  processingDir: directory("PROCESSING_DIR"),
  resultsDir: directory("RESULTS_DIR"),
  tempDir: directory("TEMP_DIR")
};