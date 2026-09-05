const pool = require("./db.js");

async function getProjectsWithLatestRun() {
  const [rows] = await pool.execute(
    `
    SELECT
      p.id AS project_id,
      p.repo_url,
      p.owner,
      p.repo_name,
      p.created_at,
      p.last_analyzed_at,

      latest_run.id AS latest_analysis_run_id,
      latest_run.run_date AS latest_run_date,
      latest_run.global_health_score,
      latest_run.overall_project_risk,
      latest_run.status

    FROM projects p

    LEFT JOIN (
      SELECT ranked_runs.*
      FROM (
        SELECT
          ar.*,

          ROW_NUMBER() OVER (
            PARTITION BY ar.project_id
            ORDER BY ar.run_date DESC, ar.id DESC
          ) AS row_number

        FROM analysis_runs ar
      ) ranked_runs

      WHERE ranked_runs.row_number = 1
    ) latest_run
      ON latest_run.project_id = p.id

    ORDER BY
      COALESCE(
        latest_run.run_date,
        p.last_analyzed_at,
        p.created_at
      ) DESC,
      p.id DESC
    `
  );

  return rows;
}

module.exports = {
  getProjectsWithLatestRun
};