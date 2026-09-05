// analysis.js
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");
const unzipper = require("unzipper");
const axios = require("axios");

const SONAR_URL = process.env.SONAR_URL;
const SONAR_TOKEN = process.env.SONAR_TOKEN;

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
  // Size
  "ncloc",

  // Complexity
  "complexity",
  "cognitive_complexity",

  // Quality / Maintainability
  "code_smells",
  "sqale_index",

  // Reliability
  "bugs",

  // Duplication
  "duplicated_lines",
  "duplicated_lines_density"
];



function execCommand(command, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      {
        cwd,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, ...extraEnv }
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("EXEC ERROR:");
          console.error(stderr || err.message);
          return reject(err);
        }

        console.log(" EXEC SUCCESS");
        resolve(stdout);
      }
    );
  });
}



async function prepareFolder(input) {
  const tmpFolder = fs.mkdtempSync(path.join(os.tmpdir(), "sonar-"));

  if (input.endsWith(".zip") && fs.existsSync(input)) {
    await fs
      .createReadStream(input)
      .pipe(unzipper.Extract({ path: tmpFolder }))
      .promise();
  } else if (input.includes("github.com")) {
    await execCommand(`git clone --depth 1 ${input} "${tmpFolder}"`);
  } else {
    throw new Error("Input must be ZIP or GitHub URL");
  }

  return tmpFolder;
}



function detectProjectRoot(folder) {
  const files = fs.readdirSync(folder);
  if (files.length === 1) {
    const maybe = path.join(folder, files[0]);
    if (fs.statSync(maybe).isDirectory()) return maybe;
  }
  return folder;
}



async function tryJavaBuild(projectRoot) {
  const isJavaProject =
    fs.existsSync(path.join(projectRoot, "pom.xml")) ||
    fs.existsSync(path.join(projectRoot, "build.gradle"));

  if (!isJavaProject) {
    console.log(" No Java build tool detected → skipping build");
    return;
  }

  console.log(" Java detected → trying optional build (safe mode)");

  try {
    if (fs.existsSync(path.join(projectRoot, "pom.xml"))) {
      await execCommand("mvn -q -DskipTests compile", projectRoot);
    }

    if (fs.existsSync(path.join(projectRoot, "build.gradle"))) {
      await execCommand("gradle build -x test", projectRoot);
    }

    console.log(" Java build completed (or partially succeeded)");
  } catch (err) {
    console.log(" Java build failed  continuing in SAFE MODE");
  }
}


function generateSonarProperties(folder, projectKey, isJavaProject) {
  let content = `
sonar.projectKey=${projectKey}
sonar.projectName=${projectKey}
sonar.sources=.
sonar.sourceEncoding=UTF-8
sonar.host.url=${SONAR_URL}
sonar.token=${SONAR_TOKEN}
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

  const scannerPath = path.join(
    process.env.SONAR_SCANNER_HOME || "",
    "bin",
    process.platform === "win32"
      ? "sonar-scanner.bat"
      : "sonar-scanner"
  );

  console.log(" Scanner path:", scannerPath);

  if (!fs.existsSync(scannerPath)) {
    throw new Error("SonarScanner not found (check SONAR_SCANNER_HOME)");
  }

  const output = await execCommand(
    `"${scannerPath}" -X`,
    folder,
    { SONAR_TOKEN }
  );

  console.log("===== SCANNER OUTPUT =====");
  console.log(output);
  console.log("==========================");
}



async function fetchMetrics(projectKey, timeoutMs = 120000) {
  console.log(" Fetching metrics for:", projectKey);

  const start = Date.now();

  while (true) {
    const res = await axios.get(
      `${SONAR_URL}/api/measures/component`,
      {
        params: {
          component: projectKey,
          metricKeys: METRICS.join(",")
        },
        headers: {
          Authorization: `Bearer ${SONAR_TOKEN}`
        }
      }
    );

    const measures = res.data.component?.measures;

    if (measures?.length) return measures;

    if (Date.now() - start > timeoutMs) {
      throw new Error("Timeout waiting for Sonar results");
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}


async function fetchFileMetrics(projectKey) {
  console.log(" Fetching file-level metrics for:", projectKey);

  const pageSize = 500;
  let page = 1;
  let allFiles = [];

  while (true) {
    const res = await axios.get(
      `${SONAR_URL}/api/measures/component_tree`,
      {
        params: {
          component: projectKey,
          metricKeys: FILE_METRICS.join(","),
          qualifiers: "FIL",
          ps: pageSize,
          p: page
        },
        headers: {
          Authorization: `Bearer ${SONAR_TOKEN}`
        }
      }
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
        file.technical_debt_days = Number((file.sqale_index / 480).toFixed(2));
        file.technical_debt_display = formatTechnicalDebt(file.sqale_index);
      }

      return file;
    });

    allFiles = allFiles.concat(files);

    const paging = res.data.paging;

    if (!paging || page * pageSize >= paging.total) {
      break;
    }

    page += 1;
  }

  console.log(` File-level metrics received: ${allFiles.length} files`);

  return allFiles;
}

function formatTechnicalDebt(minutes) {
  const totalMinutes = Number(minutes) || 0;

  const days = Math.floor(totalMinutes / 480);
  const remainingMinutes = totalMinutes % 480;
  const hours = Math.floor(remainingMinutes / 60);

  if (days > 0 && hours > 0) return `${days}d ${hours}h`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;

  return "0h";
}

function formatMetrics(measures) {
  const acc = {};

  for (const m of measures) {
    const value = Number(m.value);
    acc[m.metric] = Number.isFinite(value) ? value : m.value;
  }

  const debtMinutes = acc.sqale_index ?? 0;

  acc.technical_debt_minutes = debtMinutes;
  acc.technical_debt_days = Number((debtMinutes / 480).toFixed(2));
  acc.technical_debt_display = formatTechnicalDebt(debtMinutes);

  return acc;
}



async function main(input) {
  if (!input) throw new Error("Missing input");

  console.log(" Starting analysis...");

  const folder = await prepareFolder(input);
  const projectRoot = detectProjectRoot(folder);

  const projectKey = input.replace(/[^a-zA-Z0-9]/g, "_");
  console.log(" Project key:", projectKey);


  const isJavaProject =
    fs.existsSync(path.join(projectRoot, "pom.xml")) ||
    fs.existsSync(path.join(projectRoot, "build.gradle")) ||
    fs.existsSync(path.join(projectRoot, "src"));

  if (isJavaProject) {
    console.log(" Java project detected");

    try {
      if (fs.existsSync(path.join(projectRoot, "pom.xml"))) {
        console.log(" Trying Maven build...");
        await execCommand("mvn clean compile", projectRoot);
      } else if (fs.existsSync(path.join(projectRoot, "build.gradle"))) {
        console.log(" Trying Gradle build...");
        await execCommand("gradle build", projectRoot);
      } else {
        console.log(" No build tool found  using safe mode");
      }
    } catch (err) {
      console.log(" Build failed  continuing in fallback mode");
    }
  }


  generateSonarProperties(projectRoot, projectKey, isJavaProject);

  console.log(" BEFORE SCANNER");

  try {
    await runSonarScanner(projectRoot);
  } catch (err) {
    console.error(" SCANNER FAILED:", err.message);
    throw err;
  }

  console.log(" AFTER SCANNER");

  const raw = await fetchMetrics(projectKey);

console.log(" Project metrics received");

const projectMetrics = formatMetrics(raw);

const sonarFiles = await fetchFileMetrics(projectKey);

console.log(" Sonar file metrics received");

return {
  ...projectMetrics,
  sonar_files: sonarFiles
};

}

module.exports = { main };