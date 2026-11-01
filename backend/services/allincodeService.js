
const { loginToAllinCode } = require("./allincodeAuthService.js");
const config = require("../config.js");

const DEFAULT_POLL_INTERVAL_MS = config.allincodePollIntervalMs;
const DEFAULT_ANALYSIS_TIMEOUT_MS = config.allincodeAnalysisTimeoutMs;
const DEFAULT_STEP_STALL_TIMEOUT_MS = config.allincodeStepStallTimeoutMs;
class AllinCodeApiError extends Error {
  constructor(message, { status = null, endpoint = null, responseBody = null } = {}) {
    super(message);
    this.name = "AllinCodeApiError";
    this.status = status;
    this.endpoint = endpoint;
    this.responseBody = responseBody;
  }
}

function buildUrl(endpoint, params = {}) {
  const rawBaseUrl = config.allincodeBaseUrl;
  if (!rawBaseUrl) {
    throw new Error("ALLINCODE_BASE_URL is not configured.");
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = new URL(`${baseUrl}${cleanEndpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  }

  return url.toString();
}

function tryParseJson(text) {
  if (typeof text !== "string") return text;
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }

  return text;
}

async function requestAllinCodeEndpoint(
  endpoint,
  { method = "GET", params = {}, body = undefined, headers = {} } = {}
) {
  const { accessToken } = await loginToAllinCode();

  if (!accessToken) {
    throw new Error("No access token returned from AllinCode login.");
  }

  const url = buildUrl(endpoint, params);
  console.log(`ALLINCODE ${method} URL:`, url);

  const requestHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...headers
  };

  const fetchOptions = { method, headers: requestHeaders };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    console.error(`AllinCode transport failure: ${method} ${endpoint}`, {
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code
    });
    throw error;
  }
  console.log("ALLINCODE STATUS:", response.status);

  let responseBody;
  try {
    const contentType = response.headers.get("content-type") || "";
    responseBody = contentType.includes("application/json")
      ? await response.json()
      : tryParseJson(await response.text());
  } catch (error) {
    console.error(`AllinCode response-body failure: ${method} ${endpoint}`, {
      status: response.status,
      message: error.message,
      cause: error.cause?.message,
      code: error.cause?.code
    });
    throw error;
  }

  if (!response.ok) {
    const printableBody = typeof responseBody === "string"
      ? responseBody
      : JSON.stringify(responseBody);

    throw new AllinCodeApiError(
      `AllinCode API failed: ${response.status}${printableBody ? ` - ${printableBody}` : ""}`,
      { status: response.status, endpoint, responseBody }
    );
  }

  return responseBody;
}

function fetchAllinCodeEndpoint(endpoint, params = {}) {
  return requestAllinCodeEndpoint(endpoint, { method: "GET", params });
}

function postAllinCodeEndpoint(endpoint, { params = {}, body } = {}) {
  return requestAllinCodeEndpoint(endpoint, { method: "POST", params, body });
}

function isNotFoundError(error) {
  return error?.status === 404;
}

function isRetryableAnalysisError(error) {
  return [404, 409, 425, 429, 502, 503, 504].includes(error?.status) ||
    isTransportError(error);
}

function isTransportError(error) {
  return !error?.status && (
    error?.message === "fetch failed" ||
    error?.name === "AbortError" ||
    ["ECONNRESET", "ETIMEDOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET", "EAI_AGAIN", "ECONNREFUSED"].includes(error?.cause?.code)
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNoDataResponse(value) {
  if (value === null || value === undefined) return true;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "" ||
      normalized === "null" ||
      normalized === "undefined" ||
      normalized.includes("no data") ||
      normalized.includes("not analyzed") ||
      normalized.includes("not analysed") ||
      normalized.includes("no results")
    );
  }

  if (Array.isArray(value)) return value.length === 0;

  if (typeof value === "object") {
    if (Array.isArray(value.files)) return value.files.length === 0;
    if (Array.isArray(value.data)) return value.data.length === 0;
    if (Array.isArray(value.results)) return value.results.length === 0;
    if (Array.isArray(value.items)) return value.items.length === 0;
    return Object.keys(value).length === 0;
  }

  return false;
}

function getStatusText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.toLowerCase();

  if (typeof value === "object") {
    return [
      value.status,
      value.state,
      value.phase,
      value.message,
      value.result,
      value.running
    ]
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item).toLowerCase())
      .join(" ");
  }

  return String(value).toLowerCase();
}

function isAnalysisRunning(value) {
  const statusText = getStatusText(value);

  if (/completed|complete|finished|success|succeeded|done|failed|error|cancelled|canceled/.test(statusText)) {
    return false;
  }

  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;

  if (typeof value === "object") {
    if (value.running === true || value.isRunning === true || value.active === true) {
      return true;
    }

    const progress = Number(
      value.progress ?? value.percentage ?? value.percent ?? value.completion
    );

    if (Number.isFinite(progress) && progress >= 0 && progress < 100) {
      return true;
    }

    const stepsTotal = Number(
      value.stepsTotal ?? value.totalSteps ?? value.steps_total
    );
    const stepNow = Number(
      value.stepNow ?? value.currentStep ?? value.step_now
    );

    if (
      Number.isFinite(stepsTotal) &&
      Number.isFinite(stepNow) &&
      stepsTotal > 0 &&
      stepNow >= 0 &&
      stepNow < stepsTotal
    ) {
      return true;
    }
  }

  return /running|pending|queued|started|progress|processing|in[_ -]?progress/.test(statusText);
}

async function safeGetStatus(getter) {
  try {
    return await getter();
  } catch (error) {
    if (isNotFoundError(error)) return null;

    console.warn("AllinCode status check failed:", error.message);
    console.warn("Αιτία:", error.cause?.message);
    console.warn("Κωδικός αιτίας:", error.cause?.code);
    throw error;
  }
}

async function waitForEndpointData(
  getter,
  {
    description,
    accept = (value) => !isNoDataResponse(value),
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_ANALYSIS_TIMEOUT_MS
  }
) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await getter();
      if (accept(value)) return value;
    } catch (error) {
      lastError = error;
      if (!isRetryableAnalysisError(error)) throw error;
    }

    await sleep(intervalMs);
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out while waiting for ${description}.${suffix}`);
}

function hasCollectionData(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== "object") return false;

  return [
    value.files,
    value.data,
    value.results,
    value.items,
    value.components,
    value.all
  ].some((candidate) => Array.isArray(candidate) && candidate.length > 0);
}


function validateProjectResponse(value, name) {
  const returnedName = value?.projectName ?? value?.name;

  if (returnedName && returnedName !== name) {
    throw new Error(
      `AllinCode returned ${returnedName} while requesting ${name}.`
    );
  }
}

function isMissingRunningEntry(error) {
  return (
    error?.status === 404 &&
    /RunningNow/i.test(String(error?.responseBody?.message || "")) &&
    /does(?:n't| not) exist/i.test(
      String(error?.responseBody?.message || "")
    )
  );
}



async function waitForFreshProjectData(
  owner,
  name,
  {
    observedRunning = false,
    lifecycle = {},
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_ANALYSIS_TIMEOUT_MS,
    stepStallTimeoutMs = DEFAULT_STEP_STALL_TIMEOUT_MS,
    shouldStop = () => false
  } = {}
) {
  const startedAt = Date.now();
  const graceMs = Math.min(300000, timeoutMs / 2);

  let inactiveChecks = 0;
  let lastError = null;
  let lastProgress = null;
  let highestStepSeen = null;
  let lastStepAdvanceAt = null;

  // We have actually observed an active Debt Analysis.
  let runningSeen = observedRunning;

  // An active analysis was followed by a missing running entry.
  let runningDisappeared = false;

  while (Date.now() - startedAt < timeoutMs) {
    if (shouldStop()) return null;

    let status = null;
    let missing = false;

    try {
      status = await getRunningDebt(owner, name);
    } catch (error) {
      if (isNotFoundError(error)) {
        missing = true;
      } else {
        if (error.status && !isRetryableAnalysisError(error)) {
          throw error;
        }

        lastError = error;
        inactiveChecks = 0;

        await sleep(intervalMs);
        continue;
      }
    }

    if (shouldStop()) return null;

    validateProjectResponse(status, name);

    const text = getStatusText(status);

    if (/failed|error|cancelled|canceled/.test(text)) {
      throw new Error(
        `AllinCode reported a failed/cancelled analysis for ${owner}/${name}.`
      );
    }

    const total = Number(status?.stepsTotal);
    const step = Number(status?.stepNow);

    const stepsFinished =
      status?.stepNow != null &&
      Number.isFinite(total) &&
      total > 0 &&
      Number.isFinite(step) &&
      step >= total;

    const explicitlyFinished =
      /completed|complete|finished|success|succeeded|done/.test(text);

    const running = isAnalysisRunning(status);

    if (running) {
      runningSeen = true;
      observedRunning = true;
      lifecycle.observedRunning = true;

      inactiveChecks = 0;
      runningDisappeared = false;

      const progress =
        status?.stepNow != null && status?.stepsTotal != null
          ? `${status.stepNow}/${status.stepsTotal}`
          : "in progress";

      if (progress !== lastProgress) {
        console.log(
          `AllinCode running for ${owner}/${name}: ${progress}` +
          (status?.note ? ` - ${status.note}` : "")
        );

        lastProgress = progress;
      }

      // A successful GET (HTTP 200) is not evidence of progress.
      // Reset the stall timer only when the step number increases.
      if (Number.isFinite(step) && status?.stepNow != null) {
        if (highestStepSeen === null || step > highestStepSeen) {
          highestStepSeen = step;
          lastStepAdvanceAt = Date.now();
        } else if (
          lastStepAdvanceAt !== null &&
          Date.now() - lastStepAdvanceAt >= stepStallTimeoutMs
        ) {
          const stallMessage =
            `AllinCode stalled for ${owner}/${name}: no step advancement ` +
            `for ${Math.round(stepStallTimeoutMs / 60000)} minutes ` +
            `(last observed: ${progress}).`;

          console.warn(stallMessage);
          lifecycle.stalled = true;
          lifecycle.stalledAtStep = progress;
          lifecycle.completionConfirmed = false;

          // Stop waiting on this remote analysis. It may still be running
          // on the AllinCode server, so do NOT trigger another POST.
          // Reuse existing data if available; its freshness is NOT confirmed.
          try {
            const availableFiles = await getProjectAllFilesMetricsAndDebt(owner, name);
            validateProjectResponse(availableFiles, name);

            if (hasCollectionData(availableFiles)) {
              lifecycle.projectDataSource = "stalled-available-results-unconfirmed";
              lifecycle.warning =
                `${stallMessage} Using available AllinCode results; ` +
                "they may be from a previous analysis.";
              console.warn(lifecycle.warning);
              return availableFiles;
            }
          } catch (error) {
            // Invalid project identity must never be silently accepted.
            if (/AllinCode returned .* while requesting /.test(error.message || "")) {
              throw error;
            }
            console.warn(
              `AllinCode fallback results unavailable for ${owner}/${name}:`,
              error.message
            );
          }


          lifecycle.projectDataSource = "stalled-no-available-results";
          lifecycle.warning =
            `${stallMessage} No usable AllinCode results available; ` +
            "continuing without AllinCode file metrics.";
          console.warn(lifecycle.warning);
          return [];
        }
      }

      await sleep(intervalMs);
      continue;
    }

    // Steps are displayed for information only
    if (stepsFinished && lastProgress !== `${step}/${total}`) {
      console.log(
        `AllinCode progress for ${owner}/${name}: ${step}/${total}`
      );
      lastProgress = `${step}/${total}`;
    }

    if (!missing && !explicitlyFinished && !stepsFinished) {
      inactiveChecks = 0;
      await sleep(intervalMs);
      continue;
    }

    inactiveChecks += 1;

    
    if (missing && runningSeen && !runningDisappeared) {
      runningDisappeared = true;

      console.log(
        `AllinCode running entry disappeared for ${owner}/${name}. Checking results immediately.`
      );
    }

    
    const fallbackReady =
      inactiveChecks >= 3 &&
      Date.now() - startedAt >= graceMs;

    const canCheckResults =
      runningDisappeared || fallbackReady;

    if (canCheckResults) {
      let files;

      try {
        files = await getProjectAllFilesMetricsAndDebt(owner, name);
      } catch (error) {
        if (error.status && !isRetryableAnalysisError(error)) {
          throw error;
        }

        lastError = error;
        await sleep(intervalMs);
        continue;
      }

      if (shouldStop()) return null;

      validateProjectResponse(files, name);

      if (hasCollectionData(files)) {
        lifecycle.observedRunning = observedRunning;

        lifecycle.completionConfirmed =
          observedRunning && explicitlyFinished;

        lifecycle.projectDataSource = runningDisappeared
          ? "running-disappeared-results-available"
          : lifecycle.completionConfirmed
            ? "completed-analysis"
            : "available-results-unconfirmed";

        lifecycle.warning = lifecycle.completionConfirmed
          ? null
          : runningDisappeared
            ? "AllinCode: η ενεργή ανάλυση σταμάτησε."
            : "Διαθέσιμα αποτελέσματα AllinCode:";

        if (lifecycle.warning) {
          console.warn(lifecycle.warning);
        }

        return files;
      }
    }

    await sleep(intervalMs);
  }

  if (shouldStop()) return null;

  throw new Error(
    `AllinCode: no usable results with an inactive analysis were obtained for ${owner}/${name} within the waiting limit.${
      lastError ? ` Last error: ${lastError.message}` : ""
    }`
  );
}


async function waitForRunningAnalysisToFinish(
  getter,
  {
    description,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_ANALYSIS_TIMEOUT_MS,
    startGraceMs = 15000
  }
) {
  const startedAt = Date.now();
  let observedRunning = false;

  while (Date.now() - startedAt < timeoutMs) {
    const status = await safeGetStatus(getter);
    const running = isAnalysisRunning(status);

    if (running) {
      observedRunning = true;
    } else if (observedRunning) {
      return;
    } else if (Date.now() - startedAt >= startGraceMs) {
      return;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timed out while waiting for ${description}.`);
}

// ORGANIZATION ENDPOINTS

async function getOrganizationProjects(organizationName) {
  return fetchAllinCodeEndpoint("/organization/projects", {
    name: organizationName
  });
}

async function getOrganizationStats(organizationName) {
  return fetchAllinCodeEndpoint("/organization/stats", {
    name: organizationName
  });
}

// PROJECT ENDPOINTS

async function getProject(owner, name) {
  return fetchAllinCodeEndpoint("/project", { owner, name });
}

async function getProjectOrNull(owner, name) {
  try {
    const summary = await getProjectMid(owner, name);

    if (
      summary &&
      typeof summary === "object" &&
      !Array.isArray(summary) &&
      summary.name === name
    ) {
      return summary;
    }
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  try {
    const project = await getProject(owner, name);

    if (
      !project ||
      typeof project !== "object" ||
      Array.isArray(project) ||
      project.name !== name
    ) {
      throw new Error(
        `AllinCode returned an unexpected project response for ${owner}/${name}.`
      );
    }

    return project;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
}

async function createProject(repositoryUrl, owner) {
  return postAllinCodeEndpoint("/project", {
    body: {
      url: repositoryUrl,
      owner
    }
  });
}

async function startProjectAnalysis(owner, name) {
  return postAllinCodeEndpoint("/project/analyze", {
    params: { owner, name }
  });
}

async function getProjectMid(owner, name) {
  return fetchAllinCodeEndpoint("/project/mid", { owner, name });
}

// FILE METRICS / DEBT ENDPOINTS

async function getProjectFileMetrics(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/filemetrics", {
    owner, name, all
  });
}

async function getProjectFilesDebt(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/filesdebt", {
    owner, name, all
  });
}

async function getProjectAllFilesMetricsAndDebt(owner, name) {
  return fetchAllinCodeEndpoint("/project/allfilesmetricsanddebt", {
    owner, name
  });
}

async function getProjectAllFileMetrics(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/allfilemetrics", {
    owner, name, all
  });
}

// DEBT TIMELINES

async function getDebtByWeek(owner, name) {
  return fetchAllinCodeEndpoint("/project/debtbyweek", {
    owner, name
  });
}

async function getDebtByDay(owner, name) {
  return fetchAllinCodeEndpoint("/project/debtbyday", {
    owner, name
  });
}

// COMMITS

async function getProjectCommits(owner, name) {
  return fetchAllinCodeEndpoint("/project/commits", {
    owner, name
  });
}

async function getChangesByCommit(owner, name) {
  return fetchAllinCodeEndpoint("/project/changesbycommit", {
    owner, name
  });
}

// HIGH-RISK / XAI ENDPOINTS

async function generateHighRiskProject(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project", {
    owner, name
  });
}

async function getHighRiskProjectAll(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/all", {
    owner, name
  });
}

async function getHighRiskProjectOnlyHighTD(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/hightd", {
    owner, name
  });
}

async function getHighRiskProjectExists(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/exist", {
    owner, name
  });
}

async function getHighRiskProjectThresholds(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/thresholds", {
    owner, name
  });
}

async function getHighRiskProjectCauses(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/causes", {
    owner, name
  });
}

// RUNNING ENDPOINTS

async function getRunningDebt(owner, name) {
  return fetchAllinCodeEndpoint("/running/debt", {
    owner, name
  });
}

async function getRunningHighTD(owner, name) {
  return fetchAllinCodeEndpoint("/running/hightd", {
    owner, name
  });
}

async function getRunningRefactorings(owner, name) {
  return fetchAllinCodeEndpoint("/running/refactorings", {
    owner, name
  });
}

// BASIC PROJECT ANALYSIS ORCHESTRATION

async function ensureAllinCodeProjectData({
  owner,
  name,
  repositoryUrl
}) {
  if (!owner || !name || !repositoryUrl) {
    throw new Error(
      "owner, name and repositoryUrl are required for AllinCode orchestration."
    );
  }

  const lifecycle = {
    projectExisted: false,
    projectCreated: false,
    projectAnalysisTriggered: false,
    projectDataSource: null
  };

  let project = await getProjectOrNull(owner, name);
  lifecycle.projectExisted = Boolean(project);

  if (!project) {
    console.log(" AllinCode project not found. Creating it...");

    project = await createProject(repositoryUrl, owner);
    lifecycle.projectCreated = true;
    lifecycle.projectDataSource = "created";

    await sleep(1000);
  } else {
    console.log(
      " Existing AllinCode project found. Reanalyzing it..."
    );
    lifecycle.projectDataSource = "pending";
  }

  let runningStatus = null;

  try {
    runningStatus = await getRunningDebt(owner, name);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  validateProjectResponse(runningStatus, name);

  const observedRunning = isAnalysisRunning(runningStatus);

  lifecycle.observedRunning = observedRunning;
  lifecycle.completionConfirmed = false;
  lifecycle.triggerAccepted = false;
  lifecycle.triggerStatus = null;

  let stopPolling = false;
  let pollingOutcome;

  function startPolling() {
    pollingOutcome = waitForFreshProjectData(owner, name, {
      observedRunning,
      lifecycle,
      shouldStop: () => stopPolling
    }).then(
      (files) => ({ ok: true, files }),
      (error) => ({ ok: false, error })
    );
  }

  try {
    if (!observedRunning) {
      console.log(" Starting AllinCode project analysis...");

      // Start exactly one POST and monitor concurrently.
      const postPromise = startProjectAnalysis(owner, name);

      startPolling();

      try {
        const analysisResponse = await postPromise;

        validateProjectResponse(analysisResponse, name);

        lifecycle.triggerAccepted = true;
        lifecycle.triggerStatus = 200;
        lifecycle.projectAnalysisTriggered = true;

        console.log(
          "AllinCode trigger accepted; checking execution and results."
        );
      } catch (error) {
        const busy = [406, 409].includes(error?.status);

        const transportError = isTransportError(error);
        if (!busy && !isMissingRunningEntry(error) && !transportError) {
          throw error;
        }

        lifecycle.triggerStatus = error.status ?? null;
        lifecycle.triggerAccepted = false;
        lifecycle.warning =
          "AllinCode POST not confirmed; any returned results may be from a previous analysis.";

        console.warn(
          "AllinCode trigger did not confirm execution; continuing to check status/results without repeating POST:",
          error.message,
          error.cause?.code || ""
        );
      }
    } else {
      console.log(
        " An AllinCode project analysis is already running. Waiting for it..."
      );

      startPolling();
    }

    const pollingResult = await pollingOutcome;

    if (!pollingResult.ok) {
      throw pollingResult.error;
    }

    const files = pollingResult.files;

    if (!files) {
      throw new Error(
        `AllinCode polling stopped without results for ${owner}/${name}.`
      );
    }

    let projectSummary = project;

    try {
      projectSummary = await getProjectMid(owner, name);
    } catch (error) {
      console.warn(
        "AllinCode project summary unavailable:",
        error.message
      );

      if (!projectSummary) {
        projectSummary = await getProject(owner, name);
      }
    }

    return {
      project: projectSummary,
      files,
      lifecycle
    };
  } finally {
    stopPolling = true;
  }
}

// HIGH-TD / XAI ORCHESTRATION — UNCHANGED

async function ensureAllinCodeHighRiskData({ owner, name }) {
  const lifecycle = {
    highRiskTriggered: false,
    highRiskDataSource: "reanalyzed"
  };

  let all = null;

  const runningStatus = await safeGetStatus(() =>
    getRunningHighTD(owner, name)
  );

  if (isAnalysisRunning(runningStatus)) {
    console.log(
      " An AllinCode High-TD analysis is already running. Waiting for it..."
    );

    lifecycle.highRiskDataSource = "running-analysis";

    await waitForRunningAnalysisToFinish(
      () => getRunningHighTD(owner, name),
      {
        description: `AllinCode High-TD analysis for ${owner}/${name}`
      }
    );
  } else {
    console.log(
      " Regenerating AllinCode High-TD results..."
    );

    let generated = null;

    try {
      generated = await generateHighRiskProject(owner, name);
      lifecycle.highRiskTriggered = true;
    } catch (error) {
      if (error?.status !== 409) throw error;

      console.log(
        " AllinCode High-TD analysis started by another request. Waiting for it..."
      );

      lifecycle.highRiskDataSource = "running-analysis";
    }

    if (hasCollectionData(generated)) {
      all = generated;
    } else {
      await waitForRunningAnalysisToFinish(
        () => getRunningHighTD(owner, name),
        {
          description: `AllinCode High-TD analysis for ${owner}/${name}`
        }
      );
    }
  }

  if (all === null) {
    all = await waitForEndpointData(
      () => getHighRiskProjectAll(owner, name),
      {
        description: `AllinCode High-TD results for ${owner}/${name}`
      }
    );
  }

  let highTD = [];
  let highTDAvailable = false;

  try {
    const response = await getHighRiskProjectOnlyHighTD(owner, name);

    highTD = response ?? [];
    highTDAvailable = true;
  } catch (error) {
    console.warn(
      "AllinCode High-TD-only endpoint unavailable:",
      error.message
    );
  }

  return {
    all,
    highTD,
    highTDAvailable,
    lifecycle
  };
}

// EXPORTS

module.exports = {
  AllinCodeApiError,
  requestAllinCodeEndpoint,
  fetchAllinCodeEndpoint,
  postAllinCodeEndpoint,
  isNotFoundError,
  isNoDataResponse,
  isAnalysisRunning,

  getOrganizationProjects,
  getOrganizationStats,

  getProject,
  getProjectOrNull,
  createProject,
  startProjectAnalysis,
  getProjectMid,
  ensureAllinCodeProjectData,

  getProjectFileMetrics,
  getProjectFilesDebt,
  getProjectAllFilesMetricsAndDebt,
  getProjectAllFileMetrics,

  getDebtByWeek,
  getDebtByDay,

  getProjectCommits,
  getChangesByCommit,

  generateHighRiskProject,
  getHighRiskProjectAll,
  getHighRiskProjectOnlyHighTD,
  getHighRiskProjectExists,
  getHighRiskProjectThresholds,
  getHighRiskProjectCauses,
  ensureAllinCodeHighRiskData,

  getRunningDebt,
  getRunningHighTD,
  getRunningRefactorings
};
