import MetricCard from "../MetricCard";
import HealthGauge from "../charts/HealthGauge";
import RiskBreakdownChart from "../charts/RiskBreakdownChart";

function OverviewSection({
  project,
  run,
  fileMetrics
}) {
  const formatNumber = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const numberValue =
      Number(value);

    if (Number.isNaN(numberValue)) {
      return value;
    }

    return numberValue.toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 2
      }
    );
  };

  const formatPercentage = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const numberValue =
      Number(value);

    if (Number.isNaN(numberValue)) {
      return value;
    }

    return `${numberValue.toFixed(2)}%`;
  };

  const formatTechnicalDebt = (
    minutes
  ) => {
    if (
      minutes === null ||
      minutes === undefined ||
      minutes === ""
    ) {
      return "-";
    }

    const totalMinutes =
      Number(minutes);

    if (
      Number.isNaN(totalMinutes)
    ) {
      return "-";
    }

    const days = Math.floor(
      totalMinutes / 480
    );

    const remainingMinutes =
      totalMinutes % 480;

    const hours = Math.floor(
      remainingMinutes / 60
    );

    if (days > 0 && hours > 0) {
      return `${days}d ${hours}h`;
    }

    if (days > 0) {
      return `${days} days`;
    }

    if (hours > 0) {
      return `${hours} h`;
    }

    return "0 h";
  };

  const isTrue = (value) => {
    return (
      value === true ||
      value === 1 ||
      value === "1" ||
      value === "true"
    );
  };

  const sourceFiles = (
    Array.isArray(fileMetrics)
      ? fileMetrics
      : []
  ).filter(
    (file) =>
      !isTrue(file.is_test_file)
  );

  const getHighestFile = (field) => {
    const availableFiles =
      sourceFiles.filter(
        (file) =>
          Number(file[field]) > 0
      );

    if (
      availableFiles.length === 0
    ) {
      return null;
    }

    return availableFiles.reduce(
      (highest, current) => {
        return Number(current[field]) >
          Number(highest[field])
          ? current
          : highest;
      }
    );
  };

  const highestTdRisk =
    getHighestFile(
      "high_td_risk_score"
    );

  const highestHotspot =
    getHighestFile(
      "hotspot_score"
    );

  const highestStructural =
    getHighestFile(
      "structural_risk_score"
    );

  const getShortPath = (path) => {
    if (!path) {
      return "No data available";
    }

    const normalizedPath =
      String(path);

    if (
      normalizedPath.length <= 65
    ) {
      return normalizedPath;
    }

    return `...${normalizedPath.slice(
      -62
    )}`;
  };

  return (
    <section className="overview-section">
      <div className="dashboard-page-header">
        <div>
          <h1>Overview</h1>

          <p>
            <strong>Project:</strong>{" "}
            {project?.repo_name || "-"}
          </p>

          <p className="dashboard-repository-url">
            {project?.repo_url || "-"}
          </p>
        </div>

      </div>

      <div className="overview-top-grid">
        <div className="dashboard-panel health-panel">
          <HealthGauge
            score={
              run?.global_health_score
            }
          />
        </div>

        <div className="average-metrics-section">
          <h2>
            Average Project Metrics
          </h2>

          <div className="overview-metrics-grid">
            <MetricCard
              title="Lines of Code"
              value={formatNumber(
                run?.sonar_ncloc
              )}
            />

            <MetricCard
              title="Technical Debt"
              value={formatTechnicalDebt(
                run
                  ?.sonar_technical_debt_minutes
              )}
            />

            <MetricCard
              title="Complexity"
              value={formatNumber(
                run?.sonar_complexity
              )}
            />

            <MetricCard
              title="Duplications"
              value={formatPercentage(
                run
                  ?.sonar_duplicated_lines_density
              )}
            />

            <MetricCard
              title="Code Smells"
              value={formatNumber(
                run?.sonar_code_smells
              )}
            />

            <MetricCard
              title="Bugs"
              value={formatNumber(
                run?.sonar_bugs
              )}
            />
          </div>
        </div>
      </div>

      <div className="overview-bottom-grid">
        <div>
          <h2>
            Project Risk Breakdown
          </h2>

          <div className="dashboard-panel risk-chart-panel">
            <RiskBreakdownChart
              run={run}
            />
          </div>
        </div>

        <div>
          <h2>
            Most Severe Issue Signals
          </h2>

          <div className="dashboard-panel severe-signals-panel">
            <IssueSignal
              title="File with highest TD risk"
              file={highestTdRisk}
              scoreField="high_td_risk_score"
              formatNumber={formatNumber}
              getShortPath={getShortPath}
            />

            <IssueSignal
              title="File with highest hotspot"
              file={highestHotspot}
              scoreField="hotspot_score"
              formatNumber={formatNumber}
              getShortPath={getShortPath}
            />

            <IssueSignal
              title="File with highest structural risk"
              file={highestStructural}
              scoreField="structural_risk_score"
              formatNumber={formatNumber}
              getShortPath={getShortPath}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function IssueSignal({
  title,
  file,
  scoreField,
  formatNumber,
  getShortPath
}) {
  return (
    <div className="issue-signal">
      <span className="issue-signal-label">
        {title}
      </span>

      <strong
        title={file?.path || ""}
      >
        {getShortPath(file?.path)}
      </strong>

      <span className="issue-signal-score">
        Score:{" "}
        {formatNumber(
          file?.[scoreField]
        )}
      </span>
    </div>
  );
}

export default OverviewSection;