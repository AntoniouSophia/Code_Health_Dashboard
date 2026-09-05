// services/allincodeService.js

const { loginToAllinCode } = require("./allincodeAuthService.js");

const DEFAULT_POLL_INTERVAL_MS = Number(
  process.env.ALLINCODE_POLL_INTERVAL_MS || 10000
);
const DEFAULT_ANALYSIS_TIMEOUT_MS = Number(
  process.env.ALLINCODE_ANALYSIS_TIMEOUT_MS || 24 * 60 * 60 * 1000
);

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
  const rawBaseUrl = process.env.ALLINCODE_BASE_URL;

  if (!rawBaseUrl) {
    throw new Error("ALLINCODE_BASE_URL is not configured.");
  }

  const baseUrl = rawBaseUrl.replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

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
  {
    method = "GET",
    params = {},
    body = undefined,
    headers = {}
  } = {}
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

  const fetchOptions = {
    method,
    headers: requestHeaders
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  console.log("ALLINCODE STATUS:", response.status);

  const contentType = response.headers.get("content-type") || "";
  let responseBody;

  if (contentType.includes("application/json")) {
    responseBody = await response.json().catch(() => null);
  } else {
    responseBody = tryParseJson(await response.text());
  }

  if (!response.ok) {
    const printableBody =
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody);

    throw new AllinCodeApiError(
      `AllinCode API failed: ${response.status}${
        printableBody ? ` - ${printableBody}` : ""
      }`,
      {
        status: response.status,
        endpoint,
        responseBody
      }
    );
  }

  return responseBody;
}

function fetchAllinCodeEndpoint(endpoint, params = {}) {
  return requestAllinCodeEndpoint(endpoint, {
    method: "GET",
    params
  });
}

function postAllinCodeEndpoint(endpoint, { params = {}, body } = {}) {
  return requestAllinCodeEndpoint(endpoint, {
    method: "POST",
    params,
    body
  });
}

function isNotFoundError(error) {
  return error?.status === 404 || /\b404\b/.test(error?.message || "");
}

function isRetryableAnalysisError(error) {
  return [404, 409, 425, 429, 502, 503, 504].includes(error?.status);
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
    const candidates = [
      value.status,
      value.state,
      value.phase,
      value.message,
      value.result,
      value.running
    ];

    return candidates
      .filter((item) => item !== undefined && item !== null)
      .map((item) => String(item).toLowerCase())
      .join(" ");
  }

  return String(value).toLowerCase();
}

function isAnalysisRunning(value) {
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

  const text = getStatusText(value);

  if (/completed|complete|finished|success|succeeded|done|failed|error/.test(text)) {
    return false;
  }

  return /running|pending|queued|started|progress|processing|in[_ -]?progress/.test(text);
}

async function safeGetStatus(getter) {
  try {
    return await getter();
  } catch (error) {
    if (isNotFoundError(error)) return null;
    console.warn("AllinCode status check failed:", error.message);
    return null;
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

      if (accept(value)) {
        return value;
      }
    } catch (error) {
      lastError = error;

      if (!isRetryableAnalysisError(error)) {
        throw error;
      }
    }

    await sleep(intervalMs);
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out while waiting for ${description}.${suffix}`);
}

function getAnalysisTimestamp(value, depth = 0) {
  if (value === null || value === undefined || depth > 4) return null;

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 10)) {
      const timestamp = getAnalysisTimestamp(item, depth + 1);
      if (timestamp) return timestamp;
    }
    return null;
  }

  if (typeof value !== "object") return null;

  const timestampKeys = [
    "lastAnalysisDate",
    "last_analysis_date",
    "analysisDate",
    "analysis_date",
    "lastAnalyzedAt",
    "last_analyzed_at",
    "updatedAt",
    "updated_at"
  ];

  for (const key of timestampKeys) {
    const candidate = value[key];
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      return String(candidate);
    }
  }

  const nestedKeys = ["project", "data", "result", "summary", "files"];
  for (const key of nestedKeys) {
    if (value[key] !== undefined) {
      const timestamp = getAnalysisTimestamp(value[key], depth + 1);
      if (timestamp) return timestamp;
    }
  }

  return null;
}

function hasFreshAnalysisTimestamp(currentTimestamp, previousTimestamp) {
  if (!previousTimestamp) return Boolean(currentTimestamp);
  if (!currentTimestamp) return false;

  const currentMs = Date.parse(currentTimestamp);
  const previousMs = Date.parse(previousTimestamp);

  if (Number.isFinite(currentMs) && Number.isFinite(previousMs)) {
    return currentMs > previousMs;
  }

  return currentTimestamp !== previousTimestamp;
}

function hasCollectionData(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== "object") return false;

  const candidates = [
    value.files,
    value.data,
    value.results,
    value.items,
    value.components,
    value.all
  ];

  return candidates.some((candidate) =>
    Array.isArray(candidate) && candidate.length > 0
  );
}

async function waitForFreshProjectData(
  owner,
  name,
  {
    previousAnalysisDate = null,
    hadPreviousData = false,
    intervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_ANALYSIS_TIMEOUT_MS
  } = {}
) {
  const startedAt = Date.now();
  let observedRunning = false;
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    const runningStatus = await safeGetStatus(() =>
      getRunningDebt(owner, name)
    );
    const running = isAnalysisRunning(runningStatus);

    if (running) observedRunning = true;

    try {
      const value = await getProjectAllFilesMetricsAndDebt(owner, name);

      if (!isNoDataResponse(value)) {
        const currentAnalysisDate = getAnalysisTimestamp(value);

        if (!hadPreviousData) {
          return value;
        }

        if (
          hasFreshAnalysisTimestamp(
            currentAnalysisDate,
            previousAnalysisDate
          )
        ) {
          return value;
        }


        if (observedRunning && !running && !currentAnalysisDate) {
          return value;
        }
      }
    } catch (error) {
      lastError = error;

      if (!isRetryableAnalysisError(error) && !isNotFoundError(error)) {
        throw error;
      }
    }

    await sleep(intervalMs);
  }

  const suffix = lastError ? ` Last error: ${lastError.message}` : "";
  throw new Error(
    `Timed out while waiting for the new AllinCode analysis of ${owner}/${name}.${suffix}`
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

/**
 * Organization-level endpoints
 */

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

/**
 * Project lifecycle and overview endpoints
 */

async function getProject(owner, name) {
  return fetchAllinCodeEndpoint("/project", { owner, name });
}

async function getProjectOrNull(owner, name) {
  try {
    return await getProject(owner, name);
  } catch (error) {
    if (isNotFoundError(error)) return null;
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

/**
 * File-level metrics and debt endpoints
 */

async function getProjectFileMetrics(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/filemetrics", { owner, name, all });
}

async function getProjectFilesDebt(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/filesdebt", { owner, name, all });
}

async function getProjectAllFilesMetricsAndDebt(owner, name) {
  return fetchAllinCodeEndpoint("/project/allfilesmetricsanddebt", {
    owner,
    name
  });
}

async function getProjectAllFileMetrics(owner, name, all = true) {
  return fetchAllinCodeEndpoint("/project/allfilemetrics", {
    owner,
    name,
    all
  });
}

/**
 * Debt timeline endpoints
 */

async function getDebtByWeek(owner, name) {
  return fetchAllinCodeEndpoint("/project/debtbyweek", { owner, name });
}

async function getDebtByDay(owner, name) {
  return fetchAllinCodeEndpoint("/project/debtbyday", { owner, name });
}

/**
 * Commit-related endpoints
 */

async function getProjectCommits(owner, name) {
  return fetchAllinCodeEndpoint("/project/commits", { owner, name });
}

async function getChangesByCommit(owner, name) {
  return fetchAllinCodeEndpoint("/project/changesbycommit", { owner, name });
}

/**
 * High-risk / XAI endpoints
 */

async function generateHighRiskProject(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project", { owner, name });
}

async function getHighRiskProjectAll(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/all", { owner, name });
}

async function getHighRiskProjectOnlyHighTD(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/hightd", { owner, name });
}

async function getHighRiskProjectExists(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/exist", { owner, name });
}

async function getHighRiskProjectThresholds(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/thresholds", { owner, name });
}

async function getHighRiskProjectCauses(owner, name) {
  return fetchAllinCodeEndpoint("/highrisk/project/causes", { owner, name });
}

/**
 * Running analysis status endpoints
 */

async function getRunningDebt(owner, name) {
  return fetchAllinCodeEndpoint("/running/debt", { owner, name });
}

async function getRunningHighTD(owner, name) {
  return fetchAllinCodeEndpoint("/running/hightd", { owner, name });
}

async function getRunningRefactorings(owner, name) {
  return fetchAllinCodeEndpoint("/running/refactorings", { owner, name });
}


async function ensureAllinCodeProjectData({ owner, name, repositoryUrl }) {
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
    lifecycle.projectDataSource = "created-and-analyzed";

    // Give the external service a brief moment to persist the new project.
    await sleep(1000);
  } else {
    console.log(" Existing AllinCode project found. Reanalyzing it...");
    lifecycle.projectDataSource = "reanalyzed";
  }


  let previousFiles = null;

  try {
    previousFiles = await getProjectAllFilesMetricsAndDebt(owner, name);
  } catch (error) {
    if (!isNotFoundError(error) && !isRetryableAnalysisError(error)) {
      throw error;
    }
  }

  const hadPreviousData = !isNoDataResponse(previousFiles);
  const previousAnalysisDate = hadPreviousData
    ? getAnalysisTimestamp(previousFiles)
    : null;

  const runningStatus = await safeGetStatus(() =>
    getRunningDebt(owner, name)
  );

  if (!isAnalysisRunning(runningStatus)) {
    console.log(" Starting AllinCode project analysis...");

    try {
      await startProjectAnalysis(owner, name);
      lifecycle.projectAnalysisTriggered = true;
    } catch (error) {

      if (error?.status !== 409) throw error;

      console.log(" AllinCode analysis started by another request. Waiting for it...");
      lifecycle.projectDataSource = "running-analysis";
    }
  } else {
    console.log(" An AllinCode project analysis is already running. Waiting for it...");
    lifecycle.projectDataSource = "running-analysis";
  }

  const files = await waitForFreshProjectData(owner, name, {
    previousAnalysisDate,
    hadPreviousData
  });

  let projectSummary = project;

  try {
    projectSummary = await getProjectMid(owner, name);
  } catch (error) {
    console.warn("AllinCode project summary unavailable:", error.message);

    if (!projectSummary) {
      projectSummary = await getProject(owner, name);
    }
  }

  return {
    project: projectSummary,
    files,
    lifecycle
  };
}


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
    console.log(" An AllinCode High-TD analysis is already running. Waiting for it...");
    lifecycle.highRiskDataSource = "running-analysis";

    await waitForRunningAnalysisToFinish(
      () => getRunningHighTD(owner, name),
      {
        description: `AllinCode High-TD analysis for ${owner}/${name}`
      }
    );
  } else {
    console.log(" Regenerating AllinCode High-TD results...");
    let generated = null;

    try {
      generated = await generateHighRiskProject(owner, name);
      lifecycle.highRiskTriggered = true;
    } catch (error) {
      if (error?.status !== 409) throw error;

      console.log(" AllinCode High-TD analysis started by another request. Waiting for it...");
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
    console.warn("AllinCode High-TD-only endpoint unavailable:", error.message);
  }

  return {
    all,
    highTD,
    highTDAvailable,
    lifecycle
  };
}

module.exports = {
  AllinCodeApiError,
  requestAllinCodeEndpoint,
  fetchAllinCodeEndpoint,
  postAllinCodeEndpoint,
  isNotFoundError,
  isNoDataResponse,
  isAnalysisRunning,

  // Organization
  getOrganizationProjects,
  getOrganizationStats,

  // Project lifecycle and overview
  getProject,
  getProjectOrNull,
  createProject,
  startProjectAnalysis,
  getProjectMid,
  ensureAllinCodeProjectData,

  // File-level metrics and debt
  getProjectFileMetrics,
  getProjectFilesDebt,
  getProjectAllFilesMetricsAndDebt,
  getProjectAllFileMetrics,

  // Timelines
  getDebtByWeek,
  getDebtByDay,

  // Commits
  getProjectCommits,
  getChangesByCommit,

  // High-risk / XAI
  generateHighRiskProject,
  getHighRiskProjectAll,
  getHighRiskProjectOnlyHighTD,
  getHighRiskProjectExists,
  getHighRiskProjectThresholds,
  getHighRiskProjectCauses,
  ensureAllinCodeHighRiskData,

  // Running status
  getRunningDebt,
  getRunningHighTD,
  getRunningRefactorings
};
