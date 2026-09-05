import { useMemo } from "react";

import QualityIssuesBarChart from
  "../charts/QualityIssuesBarChart";

import StructureSeverityChart from
  "../charts/StructureSeverityChart";

const STRUCTURAL_METRICS = [
  "wmc",
  "cbo",
  "rfc",
  "mpc",
  "nom",
  "dac",
  "lcom"
];

function QualityStructureSection({
  fileMetrics
}) {
  const sourceFiles = useMemo(() => {
    const files =
      Array.isArray(fileMetrics)
        ? fileMetrics
        : [];

    return files.filter((file) => {
      if (isTrue(file.is_test_file)) {
        return false;
      }

    
      if (
        file.is_current_analyzable !==
          null &&
        file.is_current_analyzable !==
          undefined &&
        !isTrue(
          file.is_current_analyzable
        )
      ) {
        return false;
      }

      if (
        file.is_code_file !== null &&
        file.is_code_file !== undefined &&
        !isTrue(file.is_code_file)
      ) {
        return false;
      }

      return true;
    });
  }, [fileMetrics]);

  const qualityFiles = useMemo(() => {
    return sourceFiles
      .filter(
        (file) =>
          isTrue(file.has_sonar_data)
      )
      .filter(
        (file) =>
          Number(
            file.quality_risk_score
          ) > 0 ||
          Number(
            file.sonar_code_smells
          ) > 0 ||
          Number(file.sonar_bugs) > 0
      )
      .slice()
      .sort(
        (a, b) =>
          Number(
            b.quality_risk_score || 0
          ) -
          Number(
            a.quality_risk_score || 0
          )
      );
  }, [sourceFiles]);

  const structureFiles =
    useMemo(() => {
      return sourceFiles
        .filter((file) => {
          if (
            isTrue(
              file.has_allincode_data
            )
          ) {
            return true;
          }

          if (
            Number(
              file.structural_risk_score
            ) > 0
          ) {
            return true;
          }

          return STRUCTURAL_METRICS.some(
            (metric) =>
              Number(file[metric]) > 0
          );
        })
        .slice()
        .sort(
          (a, b) =>
            Number(
              b.structural_risk_score ||
                0
            ) -
            Number(
              a.structural_risk_score ||
                0
            )
        );
    }, [sourceFiles]);

  const displayedStructureFiles =
    structureFiles.slice(0, 20);


const metricThresholds = useMemo(() => {
  const result = {};

  STRUCTURAL_METRICS.forEach((metric) => {
    const positiveValues =
      displayedStructureFiles
        .map((file) =>
          Number(file[metric])
        )
        .filter(
          (value) =>
            Number.isFinite(value) &&
            value > 0
        );

    result[metric] = {
      p25: calculatePercentile(
        positiveValues,
        0.25
      ),

      p50: calculatePercentile(
        positiveValues,
        0.5
      ),

      p75: calculatePercentile(
        positiveValues,
        0.75
      ),

      hasValues:
        positiveValues.length > 0
    };
  });

  return result;
}, [displayedStructureFiles]);

  return (
    <section className="quality-structure-section">
      <div className="dashboard-page-header">
        <div>
          <h1>Quality & Structure</h1>

          <p className="quality-structure-description">
            File-level quality issues and
            object-oriented structural risk.
          </p>
        </div>

    
      </div>

      <div className="quality-structure-top-grid">
        <div>
          <h2>Top Files by Quality Risk</h2>

          <div className="dashboard-panel quality-chart-panel">
            <QualityIssuesBarChart
              files={qualityFiles}
            />
          </div>
        </div>

        <div>
          <h2>
            Structure Risk Distribution
          </h2>

          <div className="dashboard-panel structure-chart-panel">
            <StructureSeverityChart
              files={structureFiles}
            />
          </div>
        </div>
      </div>

      <div className="structure-table-section">
        <div className="structure-table-heading">
          <div>
            <h2>
              Structure Issues per File
            </h2>

           <p>
  Structural metrics are coloured
  relative to the displayed files
  using project-specific quartiles.
</p>
          </div>

          <span>
            Top{" "}
            {displayedStructureFiles.length}
          </span>
        </div>

        <StructureMetricsTable
          files={displayedStructureFiles}
          thresholds={metricThresholds}
        />
      </div>
    </section>
  );
}

function SummaryCount({
  label,
  value
}) {
  return (
    <div className="quality-summary-count">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StructureMetricsTable({
  files,
  thresholds
}) {
  if (files.length === 0) {
    return (
      <div className="structure-table-empty">
        No structural metrics are
        available.
      </div>
    );
  }

  return (
    <div className="structure-table-wrapper">
      <table className="structure-metrics-table">
        <thead>
          <tr>
            <th>Path</th>
            <th>WMC</th>
            <th>CBO</th>
            <th>RFC</th>
            <th>MPC</th>
            <th>NOM</th>
            <th>DAC</th>
            <th>LCOM</th>
            <th>Structure Risk</th>
          </tr>
        </thead>

        <tbody>
          {files.map(
            (file, index) => (
              <tr
                key={
                  file.id ||
                  file.path ||
                  index
                }
              >
                <td
                  className="structure-path-cell"
                  title={file.path}
                >
                  <span>
                    #{index + 1}
                  </span>

                  {shortenPath(file.path)}
                </td>

                {STRUCTURAL_METRICS.map(
                  (metric) => (
                    <MetricHeatCell
                      key={metric}
                      value={file[metric]}
                      thresholds={thresholds[metric]}
                    />
                  )
                )}

                <td
                  className={`structure-risk-cell ${getStoredSeverity(
                    file.structural_risk_level,
                    file.structural_risk_score
                  )}`}
                >
                  {formatNumber(
                    file.structural_risk_score
                  )}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function MetricHeatCell({
  value,
  thresholds
}) {
  const severity = getRelativeSeverity(
    value,
    thresholds
  );

  return (
    <td
      className={`metric-heat-cell ${severity}`}
    >
      {formatNumber(value)}
    </td>
  );
}

function getRelativeSeverity(
  value,
  thresholds
) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "unknown";
  }

  if (numericValue === 0) {
    return "low";
  }

  if (
    !thresholds ||
    !thresholds.hasValues
  ) {
    return "unknown";
  }

  const p25 = Number(thresholds.p25);
  const p50 = Number(thresholds.p50);
  const p75 = Number(thresholds.p75);

  if (
    !Number.isFinite(p25) ||
    !Number.isFinite(p50) ||
    !Number.isFinite(p75)
  ) {
    return "unknown";
  }

  if (numericValue >= p75) {
    return "critical";
  }

  if (numericValue >= p50) {
    return "high";
  }

  if (numericValue >= p25) {
    return "medium";
  }

  return "low";
}

function getStoredSeverity(
  level,
  score
) {
  const normalizedLevel =
    String(level || "")
      .trim()
      .toLowerCase();

  if (
    ["low", "medium", "high", "critical"]
      .includes(normalizedLevel)
  ) {
    return normalizedLevel;
  }

  return scoreToSeverity(
    Number(score)
  );
}

function scoreToSeverity(score) {
  const numericScore =
    Number(score);

  if (!Number.isFinite(numericScore)) {
    return "unknown";
  }

  if (numericScore >= 80) {
    return "critical";
  }

  if (numericScore >= 60) {
    return "high";
  }

  if (numericScore >= 40) {
    return "medium";
  }

  return "low";
}

function calculatePercentile(
  values,
  percentile
) {
  if (
    !Array.isArray(values) ||
    values.length === 0
  ) {
    return 0;
  }

  const sortedValues =
    values
      .slice()
      .sort((a, b) => a - b);

  const position =
    (sortedValues.length - 1) *
    percentile;

  const lowerIndex =
    Math.floor(position);

  const upperIndex =
    Math.ceil(position);

  if (
    lowerIndex === upperIndex
  ) {
    return sortedValues[
      lowerIndex
    ];
  }

  const fraction =
    position - lowerIndex;

  return (
    sortedValues[lowerIndex] +
    (
      sortedValues[upperIndex] -
      sortedValues[lowerIndex]
    ) *
      fraction
  );
}

function isTrue(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  );
}

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  const numericValue =
    Number(value);

  if (!Number.isFinite(numericValue)) {
    return "-";
  }

  return numericValue.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 2
    }
  );
}

function shortenPath(path) {
  if (!path) {
    return "Unknown file";
  }

  const value = String(path);

  if (value.length <= 58) {
    return value;
  }

  return `...${value.slice(-55)}`;
}

export default QualityStructureSection;