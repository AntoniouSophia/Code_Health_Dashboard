const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

function runAnalyticsPipeline(inputData) {
  return new Promise((resolve, reject) => {
    const pythonCommand = process.env.PYTHON_CMD || "python";

    const scriptPath = path.join(
      __dirname,
      "..",
      "..",
      "processing",
      "analytics_pipeline.py"
    );

    const resultsDir = path.join(__dirname, "..", "results");

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const timestamp = Date.now();

    const inputPath = path.join(
      resultsDir,
      `analytics_input_${timestamp}.json`
    );

    const outputPath = path.join(
      resultsDir,
      `analytics_output_${timestamp}.json`
    );

    fs.writeFileSync(
      inputPath,
      JSON.stringify(inputData, null, 2),
      "utf-8"
    );

    console.log("Running Python analytics pipeline...");
    console.log("Input:", inputPath);
    console.log("Output:", outputPath);

    execFile(
      pythonCommand,
      [
        scriptPath,
        "--input",
        inputPath,
        "--out",
        outputPath
      ],
      {
        cwd: path.join(__dirname, ".."),
        maxBuffer: 1024 * 1024 * 100
      },
      (err, stdout, stderr) => {
        if (err) {
          console.error("PYTHON ANALYTICS ERROR:");
          console.error(stderr || err.message);
          return reject(err);
        }

        console.log(stdout);

        const raw = fs.readFileSync(outputPath, "utf-8");
        const result = JSON.parse(raw);

        resolve({
          inputPath,
          outputPath,
          result
        });
      }
    );
  });
}

module.exports = {
  runAnalyticsPipeline
};