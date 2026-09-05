import {
  useEffect,
  useMemo,
  useState
} from "react";

const VIEW_CONFIG = {
  scores: {
    label: "Risk Scores",

    columns: [
      {
        key: "git_activity_score",
        label: "Git Activity",
        format: "score"
      },
      {
        key: "complexity_score",
        label: "Complexity Score",
        format: "score",
        severity: "score"
      },
      {
        key: "hotspot_score",
        label: "Hotspot",
        format: "score",
        severityLevelKey:
          "hotspot_risk_level"
      },
      {
        key: "structural_risk_score",
        label: "Structure",
        format: "score",
        severityLevelKey:
          "structural_risk_level"
      },
      {
        key: "quality_risk_score",
        label: "Quality",
        format: "score",
        severityLevelKey:
          "quality_risk_level"
      },
      {
        key: "high_td_risk_score",
        label: "High-TD",
        format: "score",
        severityLevelKey:
          "high_td_risk_level"
      },
      {
        key: "refactoring_priority_score",
        label: "Refactoring",
        format: "score",
        severityLevelKey:
          "refactoring_priority_level"
      },
      {
        key: "display_risk_level",
        label: "Priority Level",
        format: "level",
        severity: "level"
      }
    ]
  },

  activity: {
    label: "Git & Quality",

    columns: [
      {
        key: "commit_count",
        label: "Commits",
        format: "number"
      },
      {
        key: "churn",
        label: "Churn",
        format: "number"
      },
      {
        key: "authors_count",
        label: "Authors",
        format: "number"
      },
      {
        key: "lines_added",
        label: "Lines Added",
        format: "number"
      },
      {
        key: "lines_deleted",
        label: "Lines Deleted",
        format: "number"
      },
      {
        key: "sonar_ncloc",
        label: "LOC",
        format: "number"
      },
      {
        key: "sonar_complexity",
        label: "Complexity",
        format: "number"
      },
      {
        key: "sonar_cognitive_complexity",
        label: "Cognitive",
        format: "number"
      },
      {
        key: "sonar_debt_minutes",
        label: "Sonar Debt",
        format: "minutes"
      },
      {
        key: "sonar_code_smells",
        label: "Code Smells",
        format: "number"
      },
      {
        key: "sonar_bugs",
        label: "Bugs",
        format: "number"
      },
      {
        key: "sonar_duplicated_lines",
        label: "Duplicated Lines",
        format: "number"
      },
      {
        key: "sonar_duplicated_lines_density",
        label: "Duplication",
        format: "percentage"
      },
      {
        key: "quality_risk_score",
        label: "Quality Risk",
        format: "score",
        severityLevelKey:
          "quality_risk_level"
      }
    ]
  },

  structure: {
    label: "Structure & Debt",

    columns: [
      {
        key: "allincode_loc",
        label: "AllinCode LOC",
        format: "number"
      },
      {
        key: "allincode_total_debt",
        label: "Total Debt",
        format: "decimal"
      },
      {
        key: "allincode_debt",
        label: "Debt",
        format: "decimal"
      },
      {
        key: "allincode_interest_rate",
        label: "Interest Rate",
        format: "decimal"
      },
      {
        key: "allincode_complexity",
        label: "AllinCode Complexity",
        format: "decimal"
      },
      {
        key: "wmc",
        label: "WMC",
        format: "number"
      },
      {
        key: "cbo",
        label: "CBO",
        format: "number"
      },
      {
        key: "rfc",
        label: "RFC",
        format: "number"
      },
      {
        key: "mpc",
        label: "MPC",
        format: "number"
      },
      {
        key: "nom",
        label: "NOM",
        format: "number"
      },
      {
        key: "dac",
        label: "DAC",
        format: "number"
      },
      {
        key: "lcom",
        label: "LCOM",
        format: "number"
      },
      {
        key: "high_td_probability",
        label: "High-TD Probability",
        format: "probability",
        severityLevelKey:
          "high_td_risk_level"
      },
      {
        key: "high_td",
        label: "High-TD",
        format: "boolean",
        severity: "booleanRisk"
      },
      {
        key: "structural_risk_score",
        label: "Structure Risk",
        format: "score",
        severityLevelKey:
          "structural_risk_level"
      },
      {
        key: "high_td_risk_score",
        label: "High-TD Risk",
        format: "score",
        severityLevelKey:
          "high_td_risk_level"
      }
    ]
  }
};

const PAGE_SIZE_OPTIONS = [
  25,
  50,
  100
];

function AllFileMetricsSection({
  fileMetrics
}) {
  const [searchTerm, setSearchTerm] =
    useState("");

  const [scopeFilter, setScopeFilter] =
    useState("source");

  const [riskFilter, setRiskFilter] =
    useState("all");

  const [activeView, setActiveView] =
    useState("scores");

  const [sortConfig, setSortConfig] =
    useState({
      key: "refactoring_priority_score",
      direction: "desc"
    });

  const [page, setPage] =
    useState(1);

  const [pageSize, setPageSize] =
    useState(25);

  const safeFileMetrics =
    Array.isArray(fileMetrics)
      ? fileMetrics
      : [];

  const activeColumns =
    VIEW_CONFIG[activeView].columns;

  const filteredAndSortedFiles =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      const filteredFiles =
        safeFileMetrics.filter(
          (file) => {
            const path = String(
              file.path || ""
            ).toLowerCase();

            if (
              normalizedSearch &&
              !path.includes(
                normalizedSearch
              )
            ) {
              return false;
            }

            if (
              !matchesScope(
                file,
                scopeFilter
              )
            ) {
              return false;
            }

            if (
              riskFilter !== "all" &&
              getDisplayRiskLevel(file)
                .toLowerCase() !==
                riskFilter
            ) {
              return false;
            }

            return true;
          }
        );

      return filteredFiles
        .map((file, index) => ({
          file,
          originalIndex: index
        }))
        .sort((left, right) => {
          const leftValue =
            getSortValue(
              left.file,
              sortConfig.key
            );

          const rightValue =
            getSortValue(
              right.file,
              sortConfig.key
            );

          const leftMissing =
            leftValue === null ||
            leftValue === undefined ||
            leftValue === "";

          const rightMissing =
            rightValue === null ||
            rightValue === undefined ||
            rightValue === "";

        
          if (
            leftMissing &&
            !rightMissing
          ) {
            return 1;
          }

          if (
            !leftMissing &&
            rightMissing
          ) {
            return -1;
          }

          if (
            leftMissing &&
            rightMissing
          ) {
            return (
              left.originalIndex -
              right.originalIndex
            );
          }

          let comparison = 0;

          if (
            typeof leftValue ===
              "number" &&
            typeof rightValue ===
              "number"
          ) {
            comparison =
              leftValue - rightValue;
          } else {
            comparison = String(
              leftValue
            ).localeCompare(
              String(rightValue),
              undefined,
              {
                numeric: true,
                sensitivity: "base"
              }
            );
          }

          if (comparison === 0) {
            return (
              left.originalIndex -
              right.originalIndex
            );
          }

          return sortConfig.direction ===
            "asc"
            ? comparison
            : -comparison;
        })
        .map((item) => item.file);
    }, [
      safeFileMetrics,
      searchTerm,
      scopeFilter,
      riskFilter,
      sortConfig
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredAndSortedFiles.length /
        pageSize
    )
  );

  const displayedFiles =
    useMemo(() => {
      const startIndex =
        (page - 1) * pageSize;

      return filteredAndSortedFiles.slice(
        startIndex,
        startIndex + pageSize
      );
    }, [
      filteredAndSortedFiles,
      page,
      pageSize
    ]);

  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    scopeFilter,
    riskFilter,
    activeView,
    pageSize
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [
    page,
    totalPages
  ]);

  function handleSort(key) {
    setSortConfig(
      (currentSort) => {
        if (
          currentSort.key === key
        ) {
          return {
            key,
            direction:
              currentSort.direction ===
              "asc"
                ? "desc"
                : "asc"
          };
        }

        return {
          key,
          direction: "desc"
        };
      }
    );
  }

  function clearFilters() {
    setSearchTerm("");
    setScopeFilter("source");
    setRiskFilter("all");
  }

  function exportCurrentView() {
    const headers = [
  "Path",
  ...activeColumns.map(
    (column) => column.label
  )
];

    const rows =
  filteredAndSortedFiles.map(
    (file) => [
      file.path || "",
      ...activeColumns.map(
        (column) =>
          getExportValue(
            file,
            column
          )
      )
    ]
  );

    const csvContent = [
      headers,
      ...rows
    ]
      .map((row) =>
        row
          .map(escapeCsvValue)
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csvContent],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );

    const downloadUrl =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download =
      `file-metrics-${activeView}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      downloadUrl
    );
  }

  const firstDisplayedIndex =
    filteredAndSortedFiles.length > 0
      ? (page - 1) * pageSize + 1
      : 0;

  const lastDisplayedIndex =
    Math.min(
      page * pageSize,
      filteredAndSortedFiles.length
    );

  return (
    <section className="all-files-section">
      <div className="dashboard-page-header">
        <div>
          <h1>All File Metrics</h1>

          <p className="all-files-description">
            Search, filter and compare all
            stored file-level metrics.
          </p>
        </div>
      </div>

      <div className="dashboard-panel all-files-controls">
        <div className="all-files-search-group">
          <label htmlFor="file-metrics-search">
            Search by path
          </label>

          <input
            id="file-metrics-search"
            type="search"
            value={searchTerm}
            placeholder="Search file or path..."
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
          />
        </div>

        <div className="all-files-filter-group">
          <label htmlFor="file-scope-filter">
            Files
          </label>

          <select
            id="file-scope-filter"
            value={scopeFilter}
            onChange={(event) =>
              setScopeFilter(
                event.target.value
              )
            }
          >
            <option value="source">
              Current source files
            </option>

            <option value="current">
              All current files
            </option>

            <option value="tests">
              Test files
            </option>

            <option value="git-only">
              Git-only history
            </option>

            <option value="candidates">
              Refactoring candidates
            </option>

            <option value="all">
              All database records
            </option>
          </select>
        </div>

        <div className="all-files-filter-group">
          <label htmlFor="file-risk-filter">
            Risk Level
          </label>

          <select
            id="file-risk-filter"
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All levels
            </option>

            <option value="critical">
              Critical
            </option>

            <option value="high">
              High
            </option>

            <option value="medium">
              Medium
            </option>

            <option value="low">
              Low
            </option>

            <option value="unknown">
              Unknown
            </option>
          </select>
        </div>

        <div className="all-files-control-actions">
          <button
            type="button"
            className="all-files-clear-button"
            onClick={clearFilters}
          >
            Clear
          </button>

          <button
            type="button"
            className="all-files-export-button"
            onClick={exportCurrentView}
            disabled={
              filteredAndSortedFiles.length ===
              0
            }
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="all-files-tabs">
        {Object.entries(
          VIEW_CONFIG
        ).map(
          ([
            viewKey,
            viewDefinition
          ]) => (
            <button
              key={viewKey}
              type="button"
              className={`all-files-tab ${
                activeView === viewKey
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveView(viewKey)
              }
            >
              {viewDefinition.label}
            </button>
          )
        )}
      </div>

      <div className="all-files-table-header">
        <p>
          Showing{" "}
          <strong>
            {firstDisplayedIndex}
          </strong>
          {" – "}
          <strong>
            {lastDisplayedIndex}
          </strong>{" "}
          of{" "}
          <strong>
            {
              filteredAndSortedFiles.length
            }
          </strong>
        </p>

        <label>
          Rows per page

          <select
            value={pageSize}
            onChange={(event) =>
              setPageSize(
                Number(
                  event.target.value
                )
              )
            }
          >
            {PAGE_SIZE_OPTIONS.map(
              (option) => (
                <option
                  key={option}
                  value={option}
                >
                  {option}
                </option>
              )
            )}
          </select>
        </label>
      </div>

      <FileMetricsTable
        files={displayedFiles}
        columns={activeColumns}
        sortConfig={sortConfig}
        onSort={handleSort}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}

function FileMetricsTable({
  files,
  columns,
  sortConfig,
  onSort
}) {
  if (files.length === 0) {
    return (
      <div className="all-files-empty">
        No files match the selected
        filters.
      </div>
    );
  }

  return (
    <div className="all-files-table-wrapper">
      <table className="all-files-table">
        <thead>
          <tr>
            <SortableHeader
               columnKey="path"
               label="Path"
               sortConfig={sortConfig}
               onSort={onSort}
               className="all-files-path-header"
            />

            {columns.map((column) => (
              <SortableHeader
                key={column.key}
                columnKey={column.key}
                label={column.label}
                sortConfig={sortConfig}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>

        <tbody>
          {files.map(
            (file, index) => (
              <tr
                key={
                  file.id ||
                  `${file.path}-${index}`
                }
              >
                <td
                  className="all-files-path-cell"
                  title={file.path}
                >
                  {file.path ||
                    "Unknown file"}
                </td>

                {columns.map(
                  (column) => (
                    <td
                      key={column.key}
                      className={getCellClass(
                        file,
                        column
                      )}
                      title={getCellTitle(
                        file,
                        column
                      )}
                    >
                      {formatCellValue(
                        file,
                        column
                      )}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  columnKey,
  label,
  sortConfig,
  onSort,
  className = ""
}) {
  const isActive =
    sortConfig.key === columnKey;

  return (
    <th className={className}>
      <button
        type="button"
        className={`all-files-sort-button ${
          isActive ? "active" : ""
        }`}
        onClick={() =>
          onSort(columnKey)
        }
      >
        <span>{label}</span>

        <span
          className="all-files-sort-icon"
          aria-hidden="true"
        >
          {isActive
            ? sortConfig.direction ===
              "asc"
              ? "▲"
              : "▼"
            : "↕"}
        </span>
      </button>
    </th>
  );
}


function Pagination({
  page,
  totalPages,
  onPageChange
}) {
  if (totalPages <= 1) {
    return null;
  }

  const visiblePages =
    getVisiblePages(
      page,
      totalPages
    );

  return (
    <div className="all-files-pagination">
      <button
        type="button"
        disabled={page === 1}
        onClick={() =>
          onPageChange(page - 1)
        }
      >
        ← Previous
      </button>

      <div className="all-files-page-numbers">
        {visiblePages.map(
          (pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              className={
                pageNumber === page
                  ? "active"
                  : ""
              }
              onClick={() =>
                onPageChange(
                  pageNumber
                )
              }
            >
              {pageNumber}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        disabled={
          page === totalPages
        }
        onClick={() =>
          onPageChange(page + 1)
        }
      >
        Next →
      </button>
    </div>
  );
}

function matchesScope(
  file,
  scope
) {
  switch (scope) {
    case "source":
      return (
        isCurrentAnalyzable(file) &&
        !isTrue(file.is_test_file) &&
        (
          file.is_code_file ===
            null ||
          file.is_code_file ===
            undefined ||
          isTrue(file.is_code_file)
        )
      );

    case "current":
      return isCurrentAnalyzable(
        file
      );

    case "tests":
      return isTrue(
        file.is_test_file
      );

    case "git-only":
      return isGitOnly(file);

    case "candidates":
      return isTrue(
        file.is_refactoring_candidate
      );

    case "all":
    default:
      return true;
  }
}

function isCurrentAnalyzable(file) {
  if (
    file.is_current_analyzable !==
      null &&
    file.is_current_analyzable !==
      undefined
  ) {
    return isTrue(
      file.is_current_analyzable
    );
  }

  return (
    isTrue(file.has_sonar_data) ||
    isTrue(
      file.has_allincode_data
    ) ||
    isTrue(file.has_high_td_data)
  );
}

function isGitOnly(file) {
  if (
    file.is_git_only !== null &&
    file.is_git_only !== undefined
  ) {
    return isTrue(file.is_git_only);
  }

  return (
    isTrue(file.has_git_data) &&
    !isTrue(file.has_sonar_data) &&
    !isTrue(
      file.has_allincode_data
    ) &&
    !isTrue(file.has_high_td_data)
  );
}

function getSourceNames(file) {
  const sources = [];

  if (isTrue(file.has_git_data)) {
    sources.push("Git");
  }

  if (
    isTrue(file.has_sonar_data)
  ) {
    sources.push("Sonar");
  }

  if (
    isTrue(
      file.has_allincode_data
    )
  ) {
    sources.push("AllinCode");
  }

  if (
    isTrue(file.has_high_td_data)
  ) {
    sources.push("High-TD");
  }

  return sources;
}

function getDisplayRiskLevel(file) {
  const storedLevel =
    file.final_risk_level ||
    file.refactoring_priority_level;

  const normalizedStoredLevel =
    normalizeRiskLevel(
      storedLevel
    );

  if (
    normalizedStoredLevel !==
    "Unknown"
  ) {
    return normalizedStoredLevel;
  }

  const maximumScore = Math.max(
    toFiniteNumber(
      file.hotspot_score
    ) || 0,

    toFiniteNumber(
      file.structural_risk_score
    ) || 0,

    toFiniteNumber(
      file.quality_risk_score
    ) || 0,

    toFiniteNumber(
      file.high_td_risk_score
    ) || 0,

    toFiniteNumber(
      file.refactoring_priority_score
    ) || 0
  );

  if (maximumScore <= 0) {
    return "Unknown";
  }

  return scoreToSeverity(
    maximumScore
  );
}

function getSortValue(
  file,
  key
) {
  if (
    key ===
    "display_risk_level"
  ) {
    return getRiskRank(
      getDisplayRiskLevel(file)
    );
  }

  if (key === "path") {
    return String(
      file.path || ""
    ).toLowerCase();
  }

  if (key === "high_td") {
    return isTrue(file.high_td)
      ? 1
      : 0;
  }

  const rawValue = file[key];

  if (
    rawValue === null ||
    rawValue === undefined ||
    rawValue === ""
  ) {
    return null;
  }

  const numericValue =
    Number(rawValue);

  if (
    Number.isFinite(numericValue)
  ) {
    return numericValue;
  }

  return String(rawValue)
    .toLowerCase();
}

function formatCellValue(
  file,
  column
) {
  if (
    column.key ===
    "display_risk_level"
  ) {
    return getDisplayRiskLevel(
      file
    );
  }

  const value =
    file[column.key];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  switch (column.format) {
    case "boolean":
      return isTrue(value)
        ? "Yes"
        : "No";

    case "probability":
      return formatProbability(
        value
      );

    case "percentage":
      return `${formatNumber(
        value
      )}%`;

    case "minutes":
      return formatMinutes(value);

    case "score":
    case "decimal":
    case "number":
    default:
      return formatNumber(value);
  }
}

function getCellClass(
  file,
  column
) {
  const classes = [
    "all-files-value-cell"
  ];

  let severity = "";

  if (
    column.severityLevelKey
  ) {
    severity =
      normalizeRiskLevel(
        file[
          column.severityLevelKey
        ]
      ).toLowerCase();

    if (severity === "unknown") {
      severity =
        scoreToSeverity(
          file[column.key]
        ).toLowerCase();
    }
  } else if (
    column.severity === "score"
  ) {
    severity =
      scoreToSeverity(
        file[column.key]
      ).toLowerCase();
  } else if (
    column.severity === "level"
  ) {
    severity =
      getDisplayRiskLevel(file)
        .toLowerCase();
  } else if (
    column.severity ===
    "booleanRisk"
  ) {
    severity = isTrue(
      file[column.key]
    )
      ? "critical"
      : "low";
  }

  if (
    [
      "low",
      "medium",
      "high",
      "critical",
      "unknown"
    ].includes(severity)
  ) {
    classes.push(
      "severity-cell",
      severity
    );
  }

  return classes.join(" ");
}

function getCellTitle(
  file,
  column
) {
  if (
    column.format === "minutes"
  ) {
    const value =
      toFiniteNumber(
        file[column.key]
      );

    return value === null
      ? ""
      : `${formatNumber(
          value
        )} minutes`;
  }

  return "";
}

function getExportValue(
  file,
  column
) {
  if (
    column.key ===
    "display_risk_level"
  ) {
    return getDisplayRiskLevel(
      file
    );
  }

  if (
    column.format === "boolean"
  ) {
    return isTrue(
      file[column.key]
    )
      ? "Yes"
      : "No";
  }

  if (
    column.format ===
    "probability"
  ) {
    return formatProbability(
      file[column.key]
    );
  }

  return file[column.key] ?? "";
}

function formatProbability(value) {
  const numericValue =
    toFiniteNumber(value);

  if (numericValue === null) {
    return "-";
  }

  const percentage =
    numericValue <= 1
      ? numericValue * 100
      : numericValue;

  return `${formatNumber(
    percentage
  )}%`;
}

function formatMinutes(value) {
  const numericValue =
    toFiniteNumber(value);

  if (numericValue === null) {
    return "-";
  }

  const totalMinutes =
    Math.round(numericValue);

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const days = Math.floor(
    totalMinutes / 480
  );

  const remainingMinutes =
    totalMinutes % 480;

  const hours = Math.floor(
    remainingMinutes / 60
  );

  const minutes =
    remainingMinutes % 60;

  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (
    minutes > 0 ||
    parts.length === 0
  ) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

function formatNumber(value) {
  const numericValue =
    toFiniteNumber(value);

  if (numericValue === null) {
    return "-";
  }

  return numericValue.toLocaleString(
    "en-US",
    {
      maximumFractionDigits: 2
    }
  );
}

function scoreToSeverity(score) {
  const numericScore =
    toFiniteNumber(score);

  if (numericScore === null) {
    return "Unknown";
  }

  if (numericScore >= 80) {
    return "Critical";
  }

  if (numericScore >= 60) {
    return "High";
  }

  if (numericScore >= 40) {
    return "Medium";
  }

  return "Low";
}

function normalizeRiskLevel(level) {
  const normalized =
    String(level || "")
      .trim()
      .toLowerCase();

  if (
    normalized === "critical"
  ) {
    return "Critical";
  }

  if (normalized === "high") {
    return "High";
  }

  if (
    normalized === "medium"
  ) {
    return "Medium";
  }

  if (normalized === "low") {
    return "Low";
  }

  return "Unknown";
}

function getRiskRank(level) {
  switch (
    normalizeRiskLevel(level)
  ) {
    case "Critical":
      return 4;

    case "High":
      return 3;

    case "Medium":
      return 2;

    case "Low":
      return 1;

    default:
      return 0;
  }
}

function getVisiblePages(
  page,
  totalPages
) {
  const maximumVisible = 5;

  let start = Math.max(
    1,
    page - 2
  );

  let end = Math.min(
    totalPages,
    start + maximumVisible - 1
  );

  start = Math.max(
    1,
    end - maximumVisible + 1
  );

  const pages = [];

  for (
    let current = start;
    current <= end;
    current += 1
  ) {
    pages.push(current);
  }

  return pages;
}

function toFiniteNumber(value) {
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

function escapeCsvValue(value) {
  const stringValue =
    String(value ?? "");

  return `"${stringValue.replace(
    /"/g,
    '""'
  )}"`;
}

function isTrue(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  );
}

export default AllFileMetricsSection;