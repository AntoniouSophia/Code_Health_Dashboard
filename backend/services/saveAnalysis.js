const pool = require("./db.js");

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function num(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return null;
    }

    return value;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "string") {
    let cleaned = value.trim();

    cleaned = cleaned.replace("%", "");
    cleaned = cleaned.replace("€", "");
    cleaned = cleaned.replace("$", "");
    cleaned = cleaned.replace("days", "");
    cleaned = cleaned.replace("day", "");
    cleaned = cleaned.replace(/\s/g, "");

    if (cleaned.includes(",") && cleaned.includes(".")) {
      if (cleaned.indexOf(",") < cleaned.indexOf(".")) {
        cleaned = cleaned.replace(/,/g, "");
      } else {
        cleaned = cleaned
          .replace(/\./g, "")
          .replace(",", ".");
      }
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }

    const parsed = Number(cleaned);

    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function intNum(value) {
  const n = num(value);

  if (n === null) {
    return null;
  }

  return Math.round(n);
}

function boolNum(value) {
  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  if (value === undefined || value === null || value === "") {
    return 0;
  }

  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(
      value.toLowerCase()
    )
      ? 1
      : 0;
  }

  return Number(value) ? 1 : 0;
}

function text(value) {
  if (value === undefined || value === null) {
    return null;
  }

  return String(value);
}

function dateValue(value) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

async function upsertProject(
  connection,
  projectMetrics,
  fallbackRepoUrl
) {
  const repoUrl = firstDefined(
    projectMetrics.repository,
    projectMetrics.repo_url,
    fallbackRepoUrl
  );

  const owner = firstDefined(
    projectMetrics.owner,
    ""
  );

  const repoName = firstDefined(
    projectMetrics.name,
    projectMetrics.repo_name,
    ""
  );

  if (!repoUrl) {
    throw new Error(
      "Cannot save project: repo_url is missing."
    );
  }

  const [result] = await connection.execute(
    `
    INSERT INTO projects (
      repo_url,
      owner,
      repo_name,
      last_analyzed_at
    )
    VALUES (?, ?, ?, NOW())

    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id),
      owner = VALUES(owner),
      repo_name = VALUES(repo_name),
      last_analyzed_at = NOW()
    `,
    [
      repoUrl,
      owner,
      repoName
    ]
  );

  return result.insertId;
}

async function insertAnalysisRun(
  connection,
  projectId,
  projectMetrics,
  durationSeconds = null
) {
  const runDate = dateValue(
    projectMetrics.generated_at
  );

  const columns = [
    "project_id",
    "run_date",
    "commit_sha",
    "status",
    "duration_seconds",

    "sonar_ncloc",
    "kloc",
    "sonar_technical_debt_minutes",
    "sonar_technical_debt_days",
    "sonar_td_ratio",
    "sonar_complexity",
    "sonar_cognitive_complexity",
    "sonar_code_smells",
    "sonar_bugs",
    "sonar_duplicated_lines",
    "sonar_duplicated_lines_density",
    "sonar_files",
    "sonar_classes",
    "sonar_functions",

    "allincode_reported_loc",
    "allincode_cumulative_debt",
    "allincode_interest_rate_avg",
    "allincode_refactorings",

    "total_merged_items",
    "source_items",
    "test_items",
    "items_with_git_data",
    "items_with_sonar_data",
    "items_with_allincode_data",
    "items_with_high_td_data",
    "refactoring_candidate_items",
    "project_risk_scope_items",

    "total_high_risk_items",
    "total_high_td_items",
    "source_high_td_items",
    "source_high_td_ratio",
    "average_high_td_probability",
    "max_high_td_probability",
    "top_high_td_probability_average",
    "high_td_probability_focus_count",

    "complexity_per_kloc",
    "cognitive_complexity_per_kloc",
    "code_smells_per_kloc",
    "bugs_per_kloc",

    "technical_debt_project_risk",
    "complexity_project_risk",
    "quality_project_risk",
    "duplication_project_risk",
    "hotspot_project_risk",
    "structural_project_risk",
    "high_td_project_risk",
    "overall_project_risk",
    "global_health_score",

    "average_top_hotspot_score",
    "average_top_structural_risk_score",
    "project_risk_files_count"
  ];

  const values = [
    projectId,
    runDate,
    text(projectMetrics.commit_sha),
    text(
      firstDefined(
        projectMetrics.status,
        "completed"
      )
    ),
    num(durationSeconds),

    intNum(projectMetrics.sonar_ncloc),
    num(projectMetrics.kloc),
    intNum(
      projectMetrics.sonar_technical_debt_minutes
    ),
    num(
      projectMetrics.sonar_technical_debt_days
    ),
    num(projectMetrics.sonar_td_ratio),
    intNum(projectMetrics.sonar_complexity),
    intNum(
      projectMetrics.sonar_cognitive_complexity
    ),
    intNum(projectMetrics.sonar_code_smells),
    intNum(projectMetrics.sonar_bugs),
    intNum(
      projectMetrics.sonar_duplicated_lines
    ),
    num(
      projectMetrics.sonar_duplicated_lines_density
    ),
    intNum(projectMetrics.sonar_files),
    intNum(projectMetrics.sonar_classes),
    intNum(projectMetrics.sonar_functions),

    intNum(
      firstDefined(
        projectMetrics.allincode_reported_loc,
        projectMetrics.allincode_loc
      )
    ),
    num(
      projectMetrics.allincode_cumulative_debt
    ),
    num(
      projectMetrics.allincode_interest_rate_avg
    ),
    intNum(
      projectMetrics.allincode_refactorings
    ),

    intNum(projectMetrics.total_merged_items),
    intNum(projectMetrics.source_items),
    intNum(projectMetrics.test_items),
    intNum(projectMetrics.items_with_git_data),
    intNum(projectMetrics.items_with_sonar_data),
    intNum(
      projectMetrics.items_with_allincode_data
    ),
    intNum(
      projectMetrics.items_with_high_td_data
    ),
    intNum(
      projectMetrics.refactoring_candidate_items
    ),
    intNum(
      projectMetrics.project_risk_scope_items
    ),

    intNum(projectMetrics.total_high_risk_items),
    intNum(projectMetrics.total_high_td_items),
    intNum(projectMetrics.source_high_td_items),
    num(projectMetrics.source_high_td_ratio),
    num(projectMetrics.average_high_td_probability),
    num(projectMetrics.max_high_td_probability),
    num(projectMetrics.top_high_td_probability_average),
    intNum(projectMetrics.high_td_probability_focus_count),

    num(projectMetrics.complexity_per_kloc),
    num(
      projectMetrics.cognitive_complexity_per_kloc
    ),
    num(projectMetrics.code_smells_per_kloc),
    num(projectMetrics.bugs_per_kloc),

    num(
      projectMetrics.technical_debt_project_risk
    ),
    num(projectMetrics.complexity_project_risk),
    num(projectMetrics.quality_project_risk),
    num(projectMetrics.duplication_project_risk),
    num(projectMetrics.hotspot_project_risk),
    num(projectMetrics.structural_project_risk),
    num(projectMetrics.high_td_project_risk),
    num(projectMetrics.overall_project_risk),
    num(projectMetrics.global_health_score),

    num(
      projectMetrics.average_top_hotspot_score
    ),
    num(
      projectMetrics.average_top_structural_risk_score
    ),
    intNum(
      projectMetrics.project_risk_files_count
    )
  ];

  const placeholders = columns
    .map(() => "?")
    .join(", ");

  const [result] = await connection.execute(
    `
    INSERT INTO analysis_runs (
      ${columns.join(", ")}
    )
    VALUES (${placeholders})
    `,
    values
  );

  return result.insertId;
}

async function insertMergedFileMetrics(
  connection,
  analysisRunId,
  mergedFileMetrics
) {
  if (
    !Array.isArray(mergedFileMetrics) ||
    mergedFileMetrics.length === 0
  ) {
    return 0;
  }

  const columns = [
    "analysis_run_id",
    "path",
    "is_test_file",

    "is_current_analyzable",
    "is_git_only",
    "is_code_file",
    "is_refactoring_candidate",

    "has_git_data",
    "has_sonar_data",
    "has_allincode_data",
    "has_high_td_data",

    "commit_count",
    "churn",
    "authors_count",
    "lines_added",
    "lines_deleted",

    "sonar_ncloc",
    "sonar_complexity",
    "sonar_cognitive_complexity",
    "sonar_debt_minutes",
    "sonar_code_smells",
    "sonar_bugs",
    "sonar_duplicated_lines",
    "sonar_duplicated_lines_density",

    "allincode_loc",
    "allincode_total_debt",
    "allincode_debt",
    "allincode_interest_rate",
    "allincode_complexity",

    "wmc",
    "rfc",
    "lcom",
    "mpc",
    "cbo",
    "dac",
    "nom",

    "high_td",
    "high_td_probability",
    "high_td_class_name",

    "git_activity_score",
    "complexity_score",
    "hotspot_score",
    "hotspot_risk_level",

    "structural_risk_score",
    "structural_risk_level",

    "quality_risk_score",
    "quality_risk_level",

    "high_td_risk_score",
    "high_td_risk_level",

    "refactoring_priority_score",
    "refactoring_priority_level",

    "max_component_score",
    "final_risk_level"
  ];

  const rows = mergedFileMetrics.map(
    (item) => [
      analysisRunId,
      text(item.path),
      boolNum(item.is_test_file),

      boolNum(item.is_current_analyzable),
      boolNum(item.is_git_only),
      boolNum(item.is_code_file),
      boolNum(item.is_refactoring_candidate),

      boolNum(item.has_git_data),
      boolNum(item.has_sonar_data),
      boolNum(item.has_allincode_data),
      boolNum(item.has_high_td_data),

      intNum(item.commit_count),
      intNum(item.churn),
      intNum(item.authors_count),
      intNum(item.lines_added),
      intNum(item.lines_deleted),

      intNum(item.sonar_ncloc),
      intNum(item.sonar_complexity),
      intNum(
        item.sonar_cognitive_complexity
      ),
      intNum(item.sonar_debt_minutes),
      intNum(item.sonar_code_smells),
      intNum(item.sonar_bugs),
      intNum(item.sonar_duplicated_lines),
      num(
        item.sonar_duplicated_lines_density
      ),

      intNum(item.allincode_loc),
      num(item.allincode_total_debt),
      num(item.allincode_debt),
      num(item.allincode_interest_rate),
      num(item.allincode_complexity),

      intNum(item.wmc),
      intNum(item.rfc),
      intNum(item.lcom),
      intNum(item.mpc),
      intNum(item.cbo),
      intNum(item.dac),
      intNum(item.nom),

      boolNum(item.high_td),
      num(item.high_td_probability),
      text(item.high_td_class_name),

      num(item.git_activity_score),
      num(item.complexity_score),
      num(item.hotspot_score),
      text(item.hotspot_risk_level),

      num(item.structural_risk_score),
      text(item.structural_risk_level),

      num(item.quality_risk_score),
      text(item.quality_risk_level),

      num(item.high_td_risk_score),
      text(item.high_td_risk_level),

      num(item.refactoring_priority_score),
      text(item.refactoring_priority_level),

      num(item.max_component_score),
      text(item.final_risk_level)
    ]
  );

  await connection.query(
    `
    INSERT INTO merged_file_metrics (
      ${columns.join(", ")}
    )
    VALUES ?
    `,
    [rows]
  );

  return rows.length;
}

async function insertProjectTrendHistory(
  connection,
  projectId,
  projectMetrics
) {
  const runDate = dateValue(
    projectMetrics.generated_at
  );

  await connection.execute(
    `
    INSERT INTO project_trend_history (
      project_id,
      run_date,
      commit_sha,
      sonar_technical_debt_days,
      allincode_cost,
      global_health_score,
      overall_project_risk,
      sonar_code_smells,
      sonar_bugs,
      sonar_complexity,
      sonar_duplicated_lines_density
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      projectId,
      runDate,
      text(projectMetrics.commit_sha),
      num(
        projectMetrics.sonar_technical_debt_days
      ),
      num(
        firstDefined(
          projectMetrics.allincode_cost,
          projectMetrics.allincode_cumulative_debt,
          projectMetrics.allincode_monetary_cost
        )
      ),
      num(projectMetrics.global_health_score),
      num(projectMetrics.overall_project_risk),
      intNum(projectMetrics.sonar_code_smells),
      intNum(projectMetrics.sonar_bugs),
      intNum(projectMetrics.sonar_complexity),
      num(
        projectMetrics.sonar_duplicated_lines_density
      )
    ]
  );
}

async function cleanupOldAnalysisRuns(
  connection,
  projectId
) {
  await connection.execute(
    `
    DELETE ar
    FROM analysis_runs ar

    JOIN (
      SELECT id

      FROM (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY run_date DESC, id DESC
          ) AS rn

        FROM analysis_runs
        WHERE project_id = ?
      ) ranked_runs

      WHERE rn > 2
    ) old_runs
      ON ar.id = old_runs.id
    `,
    [projectId]
  );
}

async function saveAnalysisResult({
  repoUrl,
  result,
  durationSeconds = null
}) {
  const projectMetrics =
    result.project_metrics || {};

  const mergedFileMetrics =
    result.merged_file_metrics || [];

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const projectId = await upsertProject(
      connection,
      projectMetrics,
      repoUrl
    );

    const analysisRunId =
      await insertAnalysisRun(
        connection,
        projectId,
        projectMetrics,
        durationSeconds
      );

    const insertedFileMetrics =
      await insertMergedFileMetrics(
        connection,
        analysisRunId,
        mergedFileMetrics
      );

    await insertProjectTrendHistory(
      connection,
      projectId,
      projectMetrics
    );

    await cleanupOldAnalysisRuns(
      connection,
      projectId
    );

    await connection.commit();

    return {
      project_id: projectId,
      analysis_run_id: analysisRunId,
      inserted_file_metrics:
        insertedFileMetrics
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  saveAnalysisResult
};