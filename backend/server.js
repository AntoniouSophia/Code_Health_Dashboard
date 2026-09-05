// server.js (CommonJS)

require ("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const { main } = require("./services/sonarService.js");
const { loginToAllinCode } = require("./services/allincodeAuthService.js");
const { analyzeGitMetrics } = require("./services/gitMetricsService.js");
const { runAnalyticsPipeline } = require("./services/analyticsPipelineService.js");
const { saveAnalysisResult } = require("./services/saveAnalysis.js");
const {  getAnalysisResultByRunId } = require("./services/getAnalysisResult.js");
const {  getProjectsWithLatestRun } = require("./services/getProjects.js");
const {
  getOrganizationProjects,
  getOrganizationStats,

  getProject,
  getProjectMid,

  getProjectFileMetrics,
  getProjectFilesDebt,
  getProjectAllFilesMetricsAndDebt,
  getProjectAllFileMetrics,

  getDebtByWeek,
  getDebtByDay,

  getProjectCommits,
  getChangesByCommit,

  getHighRiskProjectAll,
  getHighRiskProjectOnlyHighTD,
  getHighRiskProjectThresholds,
  getHighRiskProjectCauses,

  ensureAllinCodeProjectData,
  ensureAllinCodeHighRiskData
} = require("./services/allincodeService.js");

const app = express();

app.use(cors());
app.use(bodyParser.json());

function getBooleanQuery(value) {
  return value === true || value === "true";
}

function getRequiredQuery(req, name) {
  const value = req.query[name];

  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required query parameter: ${name}`);
  }

  return value;
}


function parseGitHubUrl(repoUrl) {
  if (!repoUrl) {
    throw new Error("Repository URL is required");
  }

  const parsedUrl = new URL(repoUrl);

  if (!parsedUrl.hostname.includes("github.com")) {
    throw new Error("Only GitHub URLs are supported");
  }

  const cleanPath = parsedUrl.pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.git$/, "");

  const parts = cleanPath.split("/");

  const owner = parts[0];
  const name = parts[1];

  if (!owner || !name) {
    throw new Error("Could not extract owner and repository name from GitHub URL");
  }

  return {
    owner,
    name
  };
}

function extractArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  if (Array.isArray(value.files)) return value.files;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.components)) return value.components;

  if (value.project) {
    if (Array.isArray(value.project.files)) return value.project.files;
    if (Array.isArray(value.project.data)) return value.project.data;
    if (Array.isArray(value.project.results)) return value.project.results;
    if (Array.isArray(value.project.items)) return value.project.items;
    if (Array.isArray(value.project.components)) return value.project.components;
  }

  if (value.highRisk) {
    if (Array.isArray(value.highRisk.all)) return value.highRisk.all;
    if (Array.isArray(value.highRisk.highTD)) return value.highRisk.highTD;
  }

  return [];
}

// SonarQube analysis route

app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const metrics = await main(url);
    res.json(metrics);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Git Metrics route

app.post("/git-metrics", async (req, res) => {
  const { url, onlySource, excludeTests } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const result = await analyzeGitMetrics(url, {
      onlySource: onlySource !== undefined ? Boolean(onlySource) : true,
      excludeTests: excludeTests !== undefined ? Boolean(excludeTests) : true
    });

    res.json({
      message: "Git metrics analysis completed successfully",
      repository: result.repoUrl,
      filters: result.gitMetrics.filters,
      totalFiles: result.gitMetrics.total_files,
      generatedAt: result.gitMetrics.generated_at,
      files: result.gitMetrics.files
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});


// AllinCode test routes

app.get("/test-allincode-login", async (req, res) => {
  try {
    const tokens = await loginToAllinCode();

    res.json({
      message: "AllinCode login successful",
      hasAccessToken: Boolean(tokens.accessToken),
      hasRefreshToken: Boolean(tokens.refreshToken)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});


app.post("/allincode-from-url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const { owner, name } = parseGitHubUrl(url);

    try {
      const project = await getProjectMid(owner, name);

      res.json({
        found: true,
        owner,
        name,
        project
      });
    } catch (error) {
      if (error.message.includes("404")) {
        return res.json({
          found: false,
          owner,
          name,
          message: "Project was not found in AllinCode."
        });
      }

      throw error;
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});


app.post("/allincode-files-from-url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const { owner, name } = parseGitHubUrl(url);

    try {
      const files = await getProjectAllFilesMetricsAndDebt(owner, name);

      res.json({
        found: true,
        owner,
        name,
        files
      });
    } catch (error) {
      if (error.message.includes("404")) {
        return res.json({
          found: false,
          owner,
          name,
          message: "Project file metrics were not found in AllinCode."
        });
      }

      throw error;
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/allincode-highrisk-from-url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const { owner, name } = parseGitHubUrl(url);

    try {
      const allHighRisk = await getHighRiskProjectAll(owner, name);
      const highTD = await getHighRiskProjectOnlyHighTD(owner, name);

      res.json({
        found: true,
        owner,
        name,
        highRisk: {
          all: allHighRisk,
          highTD
        }
      });
    } catch (error) {
      if (error.message.includes("404")) {
        return res.json({
          found: false,
          owner,
          name,
          message: "High-risk data was not found in AllinCode."
        });
      }

      throw error;
    }
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/allincode-ensure-from-url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const { owner, name } = parseGitHubUrl(url);

    const projectData = await ensureAllinCodeProjectData({
      owner,
      name,
      repositoryUrl: url
    });

    const highRiskData = await ensureAllinCodeHighRiskData({
      owner,
      name
    });

    res.json({
      message: "AllinCode project reanalysis completed and data are ready.",
      owner,
      name,
      lifecycle: {
        project: projectData.lifecycle,
        highRisk: highRiskData.lifecycle
      },
      project: projectData.project,
      fileCount: extractArray(projectData.files).length,
      highRiskCount: extractArray(highRiskData.all).length,
      highTDCount: extractArray(highRiskData.highTD).length,
      highTDAvailable: highRiskData.highTDAvailable
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/dashboard-preview-from-url", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "URL is required"
    });
  }

  try {
    const { owner, name } = parseGitHubUrl(url);

    console.log("Dashboard preview analysis started");
    console.log("Repository:", url);

    // SonarQube
    console.log("Running SonarQube analysis...");

  
    const sonarResult = await main(url);

    // Git metrics
    console.log("Running Git metrics analysis...");
    const gitResult = await analyzeGitMetrics(url, {
      onlySource: true,
      excludeTests: false
    });

    // AllinCode: reanalyze an existing project

    console.log("Preparing a new AllinCode analysis...");

    let allincodeProject = null;
    let allincodeFiles = [];
    let allincodeHighRisk = [];
    let allincodeHighTD = [];
    let allincodeHighTDAvailable = false;
    let allincodeLifecycle = {
      available: false,
      project: null,
      highRisk: null,
      error: null
    };

    try {
      const projectData = await ensureAllinCodeProjectData({
        owner,
        name,
        repositoryUrl: url
      });

      allincodeProject = projectData.project;
      allincodeFiles = projectData.files;
      allincodeLifecycle.available = true;
      allincodeLifecycle.project = projectData.lifecycle;

      const highRiskData = await ensureAllinCodeHighRiskData({
        owner,
        name
      });

      allincodeHighRisk = highRiskData.all;
      allincodeHighTD = highRiskData.highTD;
      allincodeHighTDAvailable = highRiskData.highTDAvailable;
      allincodeLifecycle.highRisk = highRiskData.lifecycle;
    } catch (error) {
      allincodeLifecycle.error = error.message;
      console.warn(
        "AllinCode project/reanalysis flow unavailable:",
        error.message
      );
    }

    // Input Python
    const analyticsInput = {
      repository: url,
      owner,
      name,

      sonar_project: sonarResult,
      sonar_files: extractArray(sonarResult?.sonar_files),

      git_files: extractArray(
        gitResult?.gitMetrics?.files ||
        gitResult?.files
      ),

      allincode_project: allincodeProject,
      allincode_files: extractArray(allincodeFiles),

      allincode_high_risk: extractArray(allincodeHighRisk),
      allincode_high_td: extractArray(allincodeHighTD),
      allincode_high_td_available: allincodeHighTDAvailable
    };

    console.log("----- ANALYTICS INPUT COUNTS -----");
    console.log("Sonar files:", analyticsInput.sonar_files.length);
    console.log("Git files:", analyticsInput.git_files.length);
    console.log("AllinCode files:", analyticsInput.allincode_files.length);
    console.log("AllinCode high risk:", analyticsInput.allincode_high_risk.length);
    console.log("AllinCode high TD:", analyticsInput.allincode_high_td.length);
    console.log("-----------------------------------");

    
   // Python merge
const analyticsOutput = await runAnalyticsPipeline(analyticsInput);

const savedToDatabase = await saveAnalysisResult({
  repoUrl: url,
  result: analyticsOutput.result
});

res.json({
  message: "Dashboard preview merge completed successfully",
  repository: url,
  owner,
  name,

  summary: analyticsOutput.result.summary,
  project_metrics: analyticsOutput.result.project_metrics,
  merged_file_metrics: analyticsOutput.result.merged_file_metrics,

  database: savedToDatabase,

  debug: {
    analyticsInputPath: analyticsOutput.inputPath,
    analyticsOutputPath: analyticsOutput.outputPath,
    allincodeLifecycle
  }
});

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }

});

app.get("/test-allincode-projects", async (req, res) => {
  try {
    const organization = getRequiredQuery(req, "organization");

    const data = await getOrganizationProjects(organization);

    res.json({
      message: "AllinCode organization projects fetched successfully",
      organization,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-organization-stats", async (req, res) => {
  try {
    const organization = getRequiredQuery(req, "organization");

    const data = await getOrganizationStats(organization);

    res.json({
      message: "AllinCode organization stats fetched successfully",
      organization,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-project", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getProject(owner, name);

    res.json({
      message: "AllinCode project fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-mid", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getProjectMid(owner, name);

    res.json({
      message: "AllinCode project mid fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-filemetrics", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");
    const all = getBooleanQuery(getRequiredQuery(req, "all"));

    const data = await getProjectFileMetrics(owner, name, all);

    res.json({
      message: "AllinCode file metrics fetched successfully",
      owner,
      name,
      all,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-filesdebt", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");
    const all = getBooleanQuery(getRequiredQuery(req, "all"));

    const data = await getProjectFilesDebt(owner, name, all);

    res.json({
      message: "AllinCode file debt fetched successfully",
      owner,
      name,
      all,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-allfilesmetricsanddebt", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getProjectAllFilesMetricsAndDebt(owner, name);

    res.json({
      message: "AllinCode all files metrics and debt fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-allfilemetrics", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");
    const all = getBooleanQuery(getRequiredQuery(req, "all"));

    const data = await getProjectAllFileMetrics(owner, name, all);

    res.json({
      message: "AllinCode all file metrics fetched successfully",
      owner,
      name,
      all,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-debtbyweek", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getDebtByWeek(owner, name);

    res.json({
      message: "AllinCode debt by week fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-debtbyday", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getDebtByDay(owner, name);

    res.json({
      message: "AllinCode debt by day fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-commits", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getProjectCommits(owner, name);

    res.json({
      message: "AllinCode commits fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-changesbycommit", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getChangesByCommit(owner, name);

    res.json({
      message: "AllinCode changes by commit fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-highrisk", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getHighRiskProjectAll(owner, name);

    res.json({
      message: "AllinCode high risk data fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-highrisk-hightd", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getHighRiskProjectOnlyHighTD(owner, name);

    res.json({
      message: "AllinCode high TD results fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-highrisk-thresholds", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getHighRiskProjectThresholds(owner, name);

    res.json({
      message: "AllinCode high risk thresholds fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/test-allincode-highrisk-causes", async (req, res) => {
  try {
    const owner = getRequiredQuery(req, "owner");
    const name = getRequiredQuery(req, "name");

    const data = await getHighRiskProjectCauses(owner, name);

    res.json({
      message: "AllinCode high risk causes fetched successfully",
      owner,
      name,
      data
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/projects", async (req, res) => {
  try {
    const projects =
      await getProjectsWithLatestRun();

    res.json({
      projects
    });
  } catch (error) {
    console.error(
      " Failed to load projects:",
      error
    );

    res.status(500).json({
      error:
        error.message ||
        "Failed to load projects."
    });
  }
});
const PORT = 3000;

app.get(
  "/api/analysis-runs/:analysisRunId",
  async (req, res) => {
    try {
      const result = await getAnalysisResultByRunId(
        req.params.analysisRunId
      );

      if (!result) {
        return res.status(404).json({
          error: "Analysis run was not found."
        });
      }

      res.json(result);
    } catch (error) {
      console.error(
        " Failed to load analysis result:",
        error
      );

      const statusCode =
        error.message === "Invalid analysis run id."
          ? 400
          : 500;

      res.status(statusCode).json({
        error: error.message
      });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});