// services/gitMetricsService.js

const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

function execCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd,
        maxBuffer: 1024 * 1024 * 100
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error(" EXEC ERROR:");
          console.error(stderr || err.message);
          return reject(err);
        }

        resolve(stdout);
      }
    );
  });
}

async function cloneRepositoryFull(repoUrl) {
  if (!repoUrl || !repoUrl.includes("github.com")) {
    throw new Error("Input must be a GitHub URL");
  }

  const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), "gitmetrics-"));

  console.log("Cloning repository for Git metrics...");
  console.log("Repo:", repoUrl);
  console.log("Folder:", tmpFolder);

  
  await execCommand(`git clone ${repoUrl} "${tmpFolder}"`, process.cwd());

  return tmpFolder;
}

function runPythonGitMetrics(repoPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const pythonCommand = process.env.PYTHON_CMD || "python";

    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "processing",
      "git_metrics.py"
    );

    let command = `"${pythonCommand}" "${scriptPath}" --repo "${repoPath}" --out "${outputPath}"`;

    if (options.onlySource) {
      command += " --only-source";
    }

    if (options.excludeTests) {
      command += " --exclude-tests";
    }

    console.log(" Running Python Git metrics script...");
    console.log(command);

    exec(
      command,
      {
        cwd: path.join(__dirname, ".."),
        maxBuffer: 1024 * 1024 * 100
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("PYTHON ERROR:");
          console.error(stderr || err.message);
          return reject(err);
        }

        console.log(stdout);
        resolve(stdout);
      }
    );
  });
}

async function analyzeGitMetrics(repoUrl, options = {}) {
  let repoPath = null;

  try {
    repoPath = await cloneRepositoryFull(repoUrl);

    const resultsDir = path.join(__dirname, "..", "results");

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const outputPath = path.join(
      resultsDir,
      `git_metrics_${Date.now()}.json`
    );

    await runPythonGitMetrics(repoPath, outputPath, options);

    const raw = fs.readFileSync(outputPath, "utf-8");
    const gitMetrics = JSON.parse(raw);

    return {
      repoUrl,
      outputPath,
      gitMetrics
    };
  } finally {
    if (repoPath && fs.existsSync(repoPath)) {
      console.log("Cleaning temporary Git repository...");
      console.log("Folder:", repoPath);

      fs.rmSync(repoPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 1000
      });

      console.log(" Temporary repository deleted.");
    }
  }
}


module.exports = {
  analyzeGitMetrics
};