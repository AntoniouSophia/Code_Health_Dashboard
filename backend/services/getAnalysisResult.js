const pool = require("./db.js");

function parseAnalysisRunId(value) {
  const analysisRunId = Number.parseInt(value, 10);

  if (
    !Number.isInteger(analysisRunId) ||
    analysisRunId <= 0
  ) {
    throw new Error("Invalid analysis run id.");
  }

  return analysisRunId;
}

async function getAnalysisResultByRunId(value) {
  const analysisRunId = parseAnalysisRunId(value);

  const [analysisRunRows] = await pool.execute(
    `
    SELECT
      ar.*,
      p.repo_url,
      p.owner,
      p.repo_name,
      p.created_at AS project_created_at,
      p.last_analyzed_at
    FROM analysis_runs ar
    INNER JOIN projects p
      ON p.id = ar.project_id
    WHERE ar.id = ?
    LIMIT 1
    `,
    [analysisRunId]
  );

  if (analysisRunRows.length === 0) {
    return null;
  }

  const databaseRow = analysisRunRows[0];

  const {
    repo_url,
    owner,
    repo_name,
    project_created_at,
    last_analyzed_at,
    ...analysisRun
  } = databaseRow;

  const [fileMetrics] = await pool.execute(
    `
    SELECT *
    FROM merged_file_metrics
    WHERE analysis_run_id = ?
    ORDER BY
      is_refactoring_candidate DESC,
      refactoring_priority_score DESC,
      hotspot_score DESC,
      path ASC
    `,
    [analysisRunId]
  );

  const [trendHistory] = await pool.execute(
    `
    SELECT *
    FROM project_trend_history
    WHERE project_id = ?
    ORDER BY run_date ASC, id ASC
    `,
    [analysisRun.project_id]
  );

  return {
    project: {
      id: analysisRun.project_id,
      repo_url,
      owner,
      repo_name,
      created_at: project_created_at,
      last_analyzed_at
    },

    analysis_run: analysisRun,

    merged_file_metrics: fileMetrics,

    trend_history: trendHistory
  };
}

module.exports = {
  getAnalysisResultByRunId
};