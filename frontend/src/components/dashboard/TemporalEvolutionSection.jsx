import { useMemo } from "react";

import TemporalDebtChart from
  "../charts/TemporalDebtChart";

function TemporalEvolutionSection({
  trendHistory = [],
  run = {},
  fileMetrics = []
}) {
  const sortedHistory = useMemo(() => {
  const chronologicalHistory = [
    ...trendHistory
  ].sort(
    (
      firstHistoryItem,
      secondHistoryItem
    ) =>
      new Date(
        firstHistoryItem.run_date
      ) -
      new Date(
        secondHistoryItem.run_date
      )
  );

  const uniqueHistory = new Map();

  chronologicalHistory.forEach(
    (historyItem) => {
      const duplicateKey =
        createHistoryDuplicateKey(
          historyItem
        );


      uniqueHistory.set(
        duplicateKey,
        historyItem
      );
    }
  );

  return Array.from(
    uniqueHistory.values()
  );
}, [trendHistory]);

  const latestHistoryItem =
    sortedHistory[
      sortedHistory.length - 1
    ] || {};

  const technicalDebtDays =
    firstAvailableNumber(
      latestHistoryItem
        .sonar_technical_debt_days,
      run.sonar_technical_debt_days
    );
  const technicalDebtMinutes =
  firstAvailableNumber(
    run.sonar_technical_debt_minutes,

    technicalDebtDays !== null
      ? technicalDebtDays * 480
      : null
  );
  const technicalDebtRatio =
    firstAvailableNumber(
      latestHistoryItem
        .sonar_td_ratio,
      run.sonar_td_ratio
    );

  const allinCodeCost =
    firstAvailableNumber(
      latestHistoryItem
        .allincode_cost,
      run.allincode_cost,
      run.allincode_cumulative_debt,
      run.allincode_monetary_cost
    );

  const highTdFiles = useMemo(
    () =>
      fileMetrics
        .filter(
          isEligibleHighTdFile
        )
        .map((file) => ({
          ...file,

          displayedHighTdScore:
            calculateHighTdScore(
              file
            )
        }))
        .sort(
          (firstFile, secondFile) =>
            secondFile
              .displayedHighTdScore -
            firstFile
              .displayedHighTdScore
        )
        .slice(0, 5),
    [fileMetrics]
  );

  return (
    <section className="temporal-section">
      <header className="dashboard-page-header temporal-page-header">
        <div>
          <h1>
            Temporal Evolution
          </h1>

          <p className="temporal-description">
            Track technical debt and
            estimated cost across saved
            analysis runs.
          </p>
        </div>

      </header>

      <div className="temporal-top-grid">
        <article className="dashboard-panel temporal-chart-panel">
          <div className="temporal-panel-heading">
            <div>
              <h2>
                Debt Evolution
              </h2>

              <p>
                Raw SonarQube debt days
                and AllinCode cost are
                shown on separate axes.
              </p>
            </div>
          </div>

          <TemporalDebtChart
            trendHistory={
              sortedHistory
            }
          />

          {sortedHistory.length === 1 && (
            <p className="temporal-single-run-note">
              A second analysis of this
              repository is required to
              display an actual trend.
            </p>
          )}
        </article>

        <div className="temporal-summary-grid">
          <TemporalSummaryCard
             title="Technical Debt"
             value={
             formatTechnicalDebt(
             technicalDebtMinutes
            )
         }
           className="debt"
/>

          <TemporalSummaryCard
            title="TD Ratio"
            value={
              formatNumber(
                technicalDebtRatio
              )
            }
            unit="%"
            className="ratio"
          />

          <TemporalSummaryCard
            title="AllinCode Cost"
            value={
              formatCurrency(
                allinCodeCost
              )
            }
            className="cost"
          />
        </div>
      </div>

      <section className="temporal-high-td-section">
        <div className="temporal-section-heading">
          <div>
            <h2>
              High-TD Risk Files
            </h2>

            <p>
              Files with the strongest
              available High-TD
              predictions in the latest
              analysis.
            </p>
          </div>

          <span>
            Top {highTdFiles.length}
          </span>
        </div>

        {highTdFiles.length > 0 ? (
          <div className="temporal-high-td-list">
            {highTdFiles.map(
              (file, index) => (
                <HighTdFileRow
                  key={
                    file.id ||
                    file.path ||
                    index
                  }
                  file={file}
                  rank={index + 1}
                />
              )
            )}
          </div>
        ) : (
          <div className="temporal-high-td-empty">
            No High-TD predictions are
            available for the latest
            analysis.
          </div>
        )}
      </section>
    </section>
  );
}

function TemporalSummaryCard({
  title,
  value,
  unit = "",
  className = ""
}) {
  return (
    <article
      className={`temporal-summary-card ${className}`}
    >
      <span>{title}</span>

      <div>
        <strong>{value}</strong>

        {unit && value !== "—" && (
          <small>{unit}</small>
        )}
      </div>
    </article>
  );
}

function HighTdFileRow({
  file,
  rank
}) {
  const score = clampScore(
    file.displayedHighTdScore
  );

  const riskLevel =
    normalizeRiskLevel(
      file.high_td_risk_level,
      score
    );

  const indicators =
    getMainIndicators(file);

  return (
    <article className="temporal-high-td-row">
      <div className="temporal-high-td-file">
        <span className="temporal-file-rank">
          #{rank}
        </span>

        <div>
          <strong
            title={
              file.path ||
              "Unknown file"
            }
          >
            {shortPath(
              file.path
            )}
          </strong>

          <small>
            {file.high_td_class_name ||
              "High-TD prediction"}
          </small>
        </div>
      </div>

      <div className="temporal-high-td-probability">
        <div className="temporal-probability-track">
          <div
            className={`temporal-probability-fill ${riskLevel}`}
            style={{
              width: `${score}%`
            }}
          />
        </div>

        <strong>
          {formatNumber(score)}%
        </strong>
      </div>

      <div
        className={`temporal-high-td-level ${riskLevel}`}
      >
        {capitalize(riskLevel)}
      </div>

      <div className="temporal-high-td-indicators">
        <span>
          Main indicators
        </span>

        <strong>
          {indicators}
        </strong>
      </div>
    </article>
  );
}

function isEligibleHighTdFile(
  file
) {
  if (!file) {
    return false;
  }

  if (
    booleanValue(
      file.is_test_file
    )
  ) {
    return false;
  }

  if (
    file.is_current_analyzable !==
      undefined &&
    !booleanValue(
      file.is_current_analyzable
    )
  ) {
    return false;
  }

  if (
    file.is_code_file !==
      undefined &&
    !booleanValue(
      file.is_code_file
    )
  ) {
    return false;
  }

  const score =
    calculateHighTdScore(file);

  const hasPrediction =
    booleanValue(
      file.has_high_td_data
    ) ||
    file.high_td_probability !==
      null &&
      file.high_td_probability !==
        undefined ||
    file.high_td_risk_score !==
      null &&
      file.high_td_risk_score !==
        undefined;

  return (
    hasPrediction &&
    score > 0
  );
}

function calculateHighTdScore(
  file
) {
  const storedScore =
    optionalNumber(
      file.high_td_risk_score
    );

  if (storedScore !== null) {
    return clampScore(
      storedScore
    );
  }

  const probability =
    optionalNumber(
      file.high_td_probability
    );

  if (probability === null) {
    return booleanValue(
      file.high_td
    )
      ? 100
      : 0;
  }

  return clampScore(
    probability <= 1
      ? probability * 100
      : probability
  );
}

function getMainIndicators(file) {
  const candidates = [
    {
      label: "WMC",
      value: optionalNumber(
        file.wmc
      )
    },
    {
      label: "RFC",
      value: optionalNumber(
        file.rfc
      )
    },
    {
      label: "CBO",
      value: optionalNumber(
        file.cbo
      )
    },
    {
      label: "LCOM",
      value: optionalNumber(
        file.lcom
      )
    },
    {
      label: "MPC",
      value: optionalNumber(
        file.mpc
      )
    },
    {
      label: "NOM",
      value: optionalNumber(
        file.nom
      )
    }
  ];

  const indicators = candidates
    .filter(
      (indicator) =>
        indicator.value !== null &&
        indicator.value > 0
    )
    .sort(
      (
        firstIndicator,
        secondIndicator
      ) =>
        secondIndicator.value -
        firstIndicator.value
    )
    .slice(0, 3)
    .map(
      (indicator) =>
        `${indicator.label} ${formatNumber(
          indicator.value
        )}`
    );

  return indicators.length > 0
    ? indicators.join(" · ")
    : "No structural indicators";
}

function normalizeRiskLevel(
  storedLevel,
  score
) {
  const normalizedLevel =
    String(
      storedLevel || ""
    )
      .trim()
      .toLowerCase();

  if (
    [
      "low",
      "medium",
      "high",
      "critical"
    ].includes(
      normalizedLevel
    )
  ) {
    return normalizedLevel;
  }

  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 40) {
    return "medium";
  }

  return "low";
}

function firstAvailableNumber(
  ...values
) {
  for (const value of values) {
    const numericValue =
      optionalNumber(value);

    if (numericValue !== null) {
      return numericValue;
    }
  }

  return null;
}

function optionalNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    Number(value);

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : null;
}

function booleanValue(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    String(value).toLowerCase() ===
      "true"
  );
}

function clampScore(value) {
  const numericValue =
    optionalNumber(value);

  if (numericValue === null) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, numericValue)
  );
}
function formatTechnicalDebt(
  minutes
) {
  const numericMinutes =
    optionalNumber(minutes);

  if (numericMinutes === null) {
    return "—";
  }

  const totalMinutes = Math.max(
    0,
    Math.round(numericMinutes)
  );

  const minutesPerDay = 480;

  const days = Math.floor(
    totalMinutes / minutesPerDay
  );

  const remainingMinutes =
    totalMinutes % minutesPerDay;

  const hours = Math.floor(
    remainingMinutes / 60
  );

  if (days > 0 && hours > 0) {
    return `${days}d ${hours}h`;
  }

  if (days > 0) {
    return `${days} d`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return "0 h";
}
function formatNumber(value) {
  const numericValue =
    optionalNumber(value);

  if (numericValue === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2
    }
  ).format(numericValue);
}

function formatCurrency(value) {
  const numericValue =
    optionalNumber(value);

  if (numericValue === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "el-GR",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 2
    }
  ).format(numericValue);
}

function shortPath(path) {
  const normalizedPath =
    String(
      path || "Unknown file"
    );

  if (
    normalizedPath.length <= 72
  ) {
    return normalizedPath;
  }

  return (
    `...` +
    normalizedPath.slice(-69)
  );
}

function capitalize(value) {
  const normalizedValue =
    String(value || "");

  return (
    normalizedValue
      .charAt(0)
      .toUpperCase() +
    normalizedValue.slice(1)
  );
}

function createHistoryDuplicateKey(
  historyItem
) {
  const analysisDate =
    getHistoryDateKey(
      historyItem?.run_date
    );

  const technicalDebtDays =
    getComparableMetricValue(
      historyItem
        ?.sonar_technical_debt_days,
      4
    );

  const allinCodeCost =
    getComparableMetricValue(
      historyItem?.allincode_cost,
      6
    );

  return [
    analysisDate,
    technicalDebtDays,
    allinCodeCost
  ].join("|");
}

function getHistoryDateKey(value) {
  if (!value) {
    return "unknown-date";
  }

  const stringValue =
    String(value);


  const isoDateMatch =
    stringValue.match(
      /^\d{4}-\d{2}-\d{2}/
    );

  if (isoDateMatch) {
    return isoDateMatch[0];
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return stringValue;
  }

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0")
  ].join("-");
}

function getComparableMetricValue(
  value,
  decimalPlaces = 6
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "null";
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return String(value);
  }

  return numericValue.toFixed(
    decimalPlaces
  );
}

export default TemporalEvolutionSection;