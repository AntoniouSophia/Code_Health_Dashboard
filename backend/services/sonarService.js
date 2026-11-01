const fs = require("fs");
const path = require("path");
const config = require("../config.js");
const { exec, execFile } = require("child_process");
const unzipper = require("unzipper");
const axios = require("axios");

const METRICS = [
  // Size
  "ncloc",

  // Complexity
  "complexity",
  "cognitive_complexity",

  // Quality / Maintainability
  "code_smells",
  "sqale_index",
  "sqale_debt_ratio",

  // Reliability
  "bugs",

  // Duplication
  "duplicated_lines",
  "duplicated_lines_density",

  // Extra project context
  "files",
  "classes",
  "functions"
];

const FILE_METRICS = [
  "ncloc",
  "complexity",
  "cognitive_complexity",
  "code_smells",
  "sqale_index",
  "bugs",
  "duplicated_lines",
  "duplicated_lines_density"
];

function quoteWindowsArgument(value) {
  const text = String(value);

  // cmd.exe expands these even inside double quotes.
  // This branch receives fixed arguments and configured batch paths.
  if (/["%!^\r\n]/.test(text)) {
    throw new Error(
      "Unsupported character in Windows batch command or path."
    );
  }

  return `"${text}"`;
}

function execCommand(
  command,
  args = [],
  cwd,
  extraEnv = {}
) {
  return new Promise((resolve, reject) => {
    const options = {
      cwd,
      maxBuffer: 1024 * 1024 * 10,
      env: {
        ...process.env,
        ...extraEnv
      }
    };

    const onComplete = (err, stdout, stderr) => {
      if (err) {
        console.error("EXEC ERROR:");
        console.error(stderr || err.message);
        return reject(err);
      }

      console.log(" EXEC SUCCESS");
      resolve(stdout);
    };

    // Windows batch launchers require cmd.exe.
    // Git and Linux commands run directly with separate arguments.
    const isWindowsBatch =
      process.platform === "win32" &&
      (
        /\.(bat|cmd)$/i.test(command) ||
        ["sonar-scanner", "mvn", "gradle"].includes(command)
      );

    if (isWindowsBatch) {
      const shellCommand = [command, ...args]
        .map(quoteWindowsArgument)
        .join(" ");

      exec(shellCommand, options, onComplete);
    } else {
      execFile(command, args, options, onComplete);
    }
  });
}

async function prepareFolder(input) {
  fs.mkdirSync(config.tempDir, {
    recursive: true
  });

  const tmpFolder = fs.mkdtempSync(
    path.join(config.tempDir, "sonar-")
  );

  if (input.endsWith(".zip") && fs.existsSync(input)) {
    await fs
      .createReadStream(input)
      .pipe(
        unzipper.Extract({
          path: tmpFolder
        })
      )
      .promise();
  } else if (input.includes("github.com")) {
    await execCommand("git", [
      "clone",
      "--depth",
      "1",
      "--",
      input,
      tmpFolder
    ]);
  } else {
    throw new Error(
      "Input must be ZIP or GitHub URL"
    );
  }

  return tmpFolder;
}

function detectProjectRoot(folder) {
  const files = fs.readdirSync(folder);

  if (files.length === 1) {
    const maybe = path.join(folder, files[0]);

    if (fs.statSync(maybe).isDirectory()) {
      return maybe;
    }
  }

  return folder;
}

async function tryJavaBuild(projectRoot) {
  const isJavaProject =
    fs.existsSync(path.join(projectRoot, "pom.xml")) ||
    fs.existsSync(path.join(projectRoot, "build.gradle"));

  if (!isJavaProject) {
    console.log(
      " No Java build tool detected → skipping build"
    );
    return;
  }

  console.log(
    " Java detected → trying optional build (safe mode)"
  );

  try {
    if (fs.existsSync(path.join(projectRoot, "pom.xml"))) {
      await execCommand(
        "mvn",
        ["-q", "-DskipTests", "compile"],
        projectRoot
      );
    }

    if (
      fs.existsSync(path.join(projectRoot, "build.gradle"))
    ) {
      await execCommand(
        "gradle",
        ["build", "-x", "test"],
        projectRoot
      );
    }

    console.log(
      " Java build completed (or partially succeeded)"
    );
  } catch (err) {
    console.log(
      " Java build failed  continuing in SAFE MODE"
    );
  }
}

function generateSonarProperties(
  folder,
  projectKey,
  isJavaProject
) {
  let content = `
sonar.projectKey=${projectKey}
sonar.projectName=${projectKey}
sonar.sources=.
sonar.sourceEncoding=UTF-8
sonar.host.url=${config.sonarUrl}
sonar.token=${config.sonarToken}
`;

  if (isJavaProject) {
    content += `
sonar.java.binaries=.
sonar.exclusions=**/*.class
`;
  }

  fs.writeFileSync(
    path.join(folder, "sonar-project.properties"),
    content.trim()
  );
}

async function runSonarScanner(folder) {
  console.log(" RUNNING SCANNER...");

  // Always use metadata from this scan,
  // never a file included in an input ZIP.
  const metadataDir = path.join(folder, ".scannerwork");

  fs.mkdirSync(metadataDir, {
    recursive: true
  });

  fs.rmSync(
    path.join(metadataDir, "report-task.txt"),
    { force: true }
  );

  const scannerHome = config.scannerHome;

  const scannerPath = scannerHome
    ? path.join(
        scannerHome,
        "bin",
        process.platform === "win32"
          ? "sonar-scanner.bat"
          : "sonar-scanner"
      )
    : "sonar-scanner";

  console.log(" Scanner:", scannerPath);

  if (scannerHome) {
    try {
      const stat = fs.statSync(scannerPath);

      if (!stat.isFile()) {
        throw new Error(
          `SonarScanner path is not a file: ${scannerPath}`
        );
      }

      if (process.platform !== "win32") {
        fs.accessSync(
          scannerPath,
          fs.constants.X_OK
        );
      }
    } catch (error) {
      if (
        error.code === "ENOENT" ||
        error.code === "ENOTDIR"
      ) {
        throw new Error(
          `SonarScanner not found at ${scannerPath}. ` +
          "Set SONAR_SCANNER_HOME to its installation root (not bin), " +
          "or leave it empty to use PATH."
        );
      }

      if (
        error.code === "EACCES" ||
        error.code === "EPERM"
      ) {
        throw new Error(
          `Cannot access or execute SonarScanner at ${scannerPath}. ` +
          "On Linux, check directory permissions and the scanner executable permission."
        );
      }

      throw error;
    }
  }

  let output;

  try {
    output = await execCommand(
      scannerPath,
      [
       "-X",
      `-Dsonar.scanner.metadataFilePath=${path.resolve(folder, ".scannerwork", "report-task.txt")}`
     ],
      folder,
      {
        SONAR_TOKEN: config.sonarToken
      }
    );
  } catch (error) {
    if (
      error.code === "ENOENT" ||
      (
        process.platform === "win32" &&
        error.code === 9009
      )
    ) {
      throw new Error(
        "SonarScanner could not be started. Check SONAR_SCANNER_HOME, " +
        "or install sonar-scanner on the backend process PATH. " +
        "On Linux, also check the executable's interpreter."
      );
    }

    if (
      error.code === "EACCES" ||
      error.code === "EPERM"
    ) {
      throw new Error(
        "Permission denied while starting SonarScanner. " +
        "Check executable/directory permissions and mount restrictions."
      );
    }

    throw error;
  }

  console.log("===== SCANNER OUTPUT =====");
  console.log(output);
  console.log("==========================");
}

function readScannerTask(folder, projectKey) {
  const metadataPath = path.join(
    folder,
    ".scannerwork",
    "report-task.txt"
  );

  let text;

  try {
    text = fs.readFileSync(metadataPath, "utf-8");
  } catch (error) {
    throw new Error(
      `Cannot read this scan's SonarQube task metadata: ${metadataPath}`
    );
  }

  const properties = {};

  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf("=");

    if (separator > 0) {
      properties[line.slice(0, separator).trim()] =
        line.slice(separator + 1).trim();
    }
  }

  if (
    !properties.ceTaskId ||
    properties.projectKey !== projectKey
  ) {
    throw new Error(
      "Missing task ID or mismatched project in SonarQube scan metadata."
    );
  }

  return properties.ceTaskId;
}

function remainingTime(deadline) {
  const remaining = deadline - Date.now();

  if (remaining <= 0) {
    throw new Error(
      "Timeout waiting for this SonarQube analysis and its metrics. " +
      "Check Background Tasks or increase SONAR_ANALYSIS_TIMEOUT_MS."
    );
  }

  return remaining;
}

async function sonarGet(endpoint, params, deadline) {
  return axios.get(`${config.sonarUrl}${endpoint}`, {
    params,
    headers: {
      Authorization: `Bearer ${config.sonarToken}`
    },
    timeout: remainingTime(deadline)
  });
}

function isRetryableSonarError(error) {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  const status = error.response?.status;

  return (
    !error.response ||
    status === 404 ||
    status === 429 ||
    status >= 500
  );
}

async function pauseSonarPoll(deadline) {
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      Math.min(
        config.sonarPollIntervalMs,
        remainingTime(deadline)
      )
    )
  );
}

async function waitForSonarTask(
  taskId,
  projectKey,
  deadline
) {
  console.log(
    "Waiting for SonarQube background task:",
    taskId
  );

  let lastStatus;

  while (true) {
    let response;

    try {
      response = await sonarGet(
        "/api/ce/task",
        { id: taskId },
        deadline
      );
    } catch (error) {
      if (!isRetryableSonarError(error)) {
        throw error;
      }

      console.log(
        "SonarQube task temporarily unavailable; retrying..."
      );

      await pauseSonarPoll(deadline);
      continue;
    }

    const task = response.data.task;

    if (
      !task ||
      task.id !== taskId ||
      (
        task.componentKey &&
        task.componentKey !== projectKey
      )
    ) {
      throw new Error(
        "SonarQube returned invalid or mismatched background task metadata."
      );
    }

    if (task.status !== lastStatus) {
      console.log(
        `SonarQube task ${taskId}: ${task.status}`
      );

      lastStatus = task.status;
    }

    if (task.status === "SUCCESS") {
      return;
    }

    if (
      task.status === "FAILED" ||
      task.status === "CANCELED"
    ) {
      throw new Error(
        `SonarQube task ${taskId} ${task.status}: ` +
        (
          task.errorMessage ||
          "Check SonarQube Background Tasks."
        )
      );
    }

    if (
      !["PENDING", "IN_PROGRESS"].includes(task.status)
    ) {
      throw new Error(
        `Unexpected SonarQube task status: ${task.status}`
      );
    }

    await pauseSonarPoll(deadline);
  }
}

async function fetchAnalysisMetrics(
  projectKey,
  deadline
) {
  // After CE success, allow a publishing/indexing delay.
  // Do not silently save an empty list when the project reports files.
  while (true) {
    try {
      const response = await sonarGet(
        "/api/measures/component",
        {
          component: projectKey,
          metricKeys: METRICS.join(",")
        },
        deadline
      );

      const measures = response.data.component?.measures;

      if (measures?.length) {
        const sonarFiles = await fetchFileMetrics(
          projectKey,
          deadline
        );

        const fileCount = measures.find(
          (item) => item.metric === "files"
        );

        const analyzedFiles = fileCount
          ? Number(fileCount.value)
          : null;

        if (
          sonarFiles.length > 0 ||
          analyzedFiles === 0
        ) {
          return {
            measures,
            sonarFiles
          };
        }
      }
    } catch (error) {
      if (!isRetryableSonarError(error)) {
        throw error;
      }
    }

    console.log(
      "SonarQube metrics/file list not ready; retrying..."
    );

    await pauseSonarPoll(deadline);
  }
}

async function fetchFileMetrics(
  projectKey,
  deadline
) {
  console.log(
    " Fetching file-level metrics for:",
    projectKey
  );

  const pageSize = 500;
  let page = 1;
  let allFiles = [];

  while (true) {
    const res = await sonarGet(
      "/api/measures/component_tree",
      {
        component: projectKey,
        metricKeys: FILE_METRICS.join(","),
        qualifiers: "FIL",
        ps: pageSize,
        p: page
      },
      deadline
    );

    const components = res.data.components || [];

    const files = components.map((component) => {
      const file = {
        key: component.key,
        name: component.name,
        path: component.path || component.name
      };

      for (const measure of component.measures || []) {
        const value = Number(measure.value);

        file[measure.metric] = Number.isFinite(value)
          ? value
          : measure.value;
      }

      if (file.sqale_index !== undefined) {
        file.technical_debt_minutes = file.sqale_index;

        file.technical_debt_days = Number(
          (file.sqale_index / 480).toFixed(2)
        );

        file.technical_debt_display =
          formatTechnicalDebt(file.sqale_index);
      }

      return file;
    });

    allFiles = allFiles.concat(files);

    const paging = res.data.paging;

    if (
      !paging ||
      page * pageSize >= paging.total
    ) {
      break;
    }

    page += 1;
  }

  console.log(
    ` File-level metrics received: ${allFiles.length} files`
  );

  return allFiles;
}

function formatTechnicalDebt(minutes) {
  const totalMinutes = Number(minutes) || 0;

  const days = Math.floor(totalMinutes / 480);
  const remainingMinutes = totalMinutes % 480;
  const hours = Math.floor(remainingMinutes / 60);

  if (days > 0 && hours > 0) {
    return `${days}d ${hours}h`;
  }

  if (days > 0) {
    return `${days}d`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return "0h";
}

function formatMetrics(measures) {
  const acc = {};

  for (const measure of measures) {
    const value = Number(measure.value);

    acc[measure.metric] = Number.isFinite(value)
      ? value
      : measure.value;
  }

  const debtMinutes = acc.sqale_index ?? 0;

  acc.technical_debt_minutes = debtMinutes;

  acc.technical_debt_days = Number(
    (debtMinutes / 480).toFixed(2)
  );

  acc.technical_debt_display =
    formatTechnicalDebt(debtMinutes);

  return acc;
}

async function main(input) {
  if (!input) {
    throw new Error("Missing input");
  }

  console.log(" Starting analysis...");

  const folder = await prepareFolder(input);
  const projectRoot = detectProjectRoot(folder);

  const projectKey = input.replace(
    /[^a-zA-Z0-9]/g,
    "_"
  );

  console.log(" Project key:", projectKey);

  const isJavaProject =
    fs.existsSync(path.join(projectRoot, "pom.xml")) ||
    fs.existsSync(path.join(projectRoot, "build.gradle")) ||
    fs.existsSync(path.join(projectRoot, "src"));

  if (isJavaProject) {
    console.log(" Java project detected");

    try {
      if (
        fs.existsSync(path.join(projectRoot, "pom.xml"))
      ) {
        console.log(" Trying Maven build...");

        await execCommand(
          "mvn",
          ["clean", "compile"],
          projectRoot
        );
      } else if (
        fs.existsSync(path.join(projectRoot, "build.gradle"))
      ) {
        console.log(" Trying Gradle build...");

        await execCommand(
          "gradle",
          ["build"],
          projectRoot
        );
      } else {
        console.log(
          " No build tool found  using safe mode"
        );
      }
    } catch (err) {
      console.log(
        " Build failed  continuing in fallback mode"
      );
    }
  }

  generateSonarProperties(
    projectRoot,
    projectKey,
    isJavaProject
  );

  console.log(" BEFORE SCANNER");

  try {
    await runSonarScanner(projectRoot);
  } catch (err) {
    console.error(
      " SCANNER FAILED:",
      err.message
    );

    throw err;
  }

  console.log(" AFTER SCANNER");

  const taskId = readScannerTask(
    projectRoot,
    projectKey
  );

  const deadline =
    Date.now() + config.sonarAnalysisTimeoutMs;

  await waitForSonarTask(
    taskId,
    projectKey,
    deadline
  );

  const {
    measures: raw,
    sonarFiles
  } = await fetchAnalysisMetrics(
    projectKey,
    deadline
  );

  console.log(" Project metrics received");

  const projectMetrics = formatMetrics(raw);

  console.log(" Sonar file metrics received");

  return {
    ...projectMetrics,
    sonar_files: sonarFiles
  };
}

module.exports = {
  main
};