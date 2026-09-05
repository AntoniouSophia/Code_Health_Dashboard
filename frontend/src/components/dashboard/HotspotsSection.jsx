import {
  useMemo,
  useState
} from "react";

import HotspotBubbleChart from
  "../charts/HotspotBubbleChart";


function HotspotsSection({
  fileMetrics,
  run
}) {
   const [bubbleLimit, setBubbleLimit] =
    useState(40);

 
  const eligibleFiles = useMemo(() => {
    const files =
      Array.isArray(fileMetrics)
        ? fileMetrics
        : [];

    return files.filter((file) => {
      if (isTrue(file.is_test_file)) {
        return false;
      }

      if (
        !isTrue(
          file.is_current_analyzable
        )
      ) {
        return false;
      }

      if (isTrue(file.is_git_only)) {
        return false;
      }

      if (
        file.is_code_file !== null &&
        file.is_code_file !== undefined &&
        !isTrue(file.is_code_file)
      ) {
        return false;
      }

      if (!isTrue(file.has_git_data)) {
        return false;
      }

      const hasComplexitySource =
        isTrue(file.has_sonar_data) ||
        isTrue(file.has_allincode_data);

      return hasComplexitySource;
    });
  }, [fileMetrics]);


  const hotspotFiles = useMemo(() => {
    return eligibleFiles
      .filter(
        (file) =>
          Number(
            file.hotspot_score || 0
          ) > 0
      )
      .slice()
      .sort(
        (a, b) =>
          Number(
            b.hotspot_score || 0
          ) -
          Number(
            a.hotspot_score || 0
          )
      );
  }, [eligibleFiles]);

  const displayedHotspotFiles =
  useMemo(() => {
    if (bubbleLimit === "all") {
      return hotspotFiles;
    }

    return hotspotFiles.slice(
      0,
      Number(bubbleLimit)
    );
  }, [hotspotFiles, bubbleLimit]);


  const refactoringCandidates =
    useMemo(() => {
      return eligibleFiles
        .filter(
          (file) =>
            isTrue(
              file.is_refactoring_candidate
            ) ||
            Number(
              file.refactoring_priority_score
            ) > 0
        )
        .slice()
        .sort(
          (a, b) =>
            Number(
              b.refactoring_priority_score ||
                0
            ) -
            Number(
              a.refactoring_priority_score ||
                0
            )
        )
        .slice(0, 15);
    }, [eligibleFiles]);

  const [
    selectedFile,
    setSelectedFile
  ] = useState(null);

  const projectSummary = useMemo(() => {
    const averageHotspotScore =
      getAverage(
        eligibleFiles,
        (file) => file.hotspot_score
      );

    return {
      hotspotScore: firstNumber(
        run?.average_top_hotspot_score,
        run?.hotspot_project_risk,
        averageHotspotScore
      ),

      fileCount: eligibleFiles.length,

      averageCommits: getAverage(
        eligibleFiles,
        (file) => file.commit_count
      ),

      averageChurn: getAverage(
        eligibleFiles,
        (file) => file.churn
      ),

      averageAuthors: getAverage(
        eligibleFiles,
        (file) => file.authors_count
      ),

      totalLoc: getTotal(
        eligibleFiles,
        getFileLoc
      ),

      totalComplexity: getTotal(
        eligibleFiles,
        getFileComplexity
      ),

      averageComplexityScore:
        getAverage(
          eligibleFiles,
          (file) =>
            file.complexity_score
        ),

      averageGitActivity:
        getAverage(
          eligibleFiles,
          (file) =>
            file.git_activity_score
        )
    };
  }, [eligibleFiles, run]);

  return (
    <section className="hotspots-section">
      <div className="dashboard-page-header">
        <div>
          <h1>Hotspots</h1>

          <p className="hotspots-description">
            Complexity, change activity and
            refactoring priority at file level.
          </p>
        </div>

      
      </div>

      <div className="hotspots-main-grid">
        <div className="dashboard-panel hotspot-chart-panel">
            
            <div className="hotspot-chart-toolbar">
  <span>
    Showing{" "}
    <strong>
      {displayedHotspotFiles.length}
    </strong>{" "}
    of{" "}
    <strong>
      {hotspotFiles.length}
    </strong>{" "}
    files
  </span>

  <label>
    Display

    <select
      value={bubbleLimit}
      onChange={(event) =>
        setBubbleLimit(
          event.target.value === "all"
            ? "all"
            : Number(event.target.value)
        )
      }
    >
      <option value={25}>Top 25</option>
      <option value={40}>Top 40</option>
      <option value={60}>Top 60</option>
      <option value="all">All</option>
    </select>
  </label>
</div>

          <HotspotBubbleChart
            files={displayedHotspotFiles}
            onSelectFile={setSelectedFile}
          />

          <p className="hotspot-chart-help">
            Bubble position: complexity and
            commits · Bubble size: churn ·
            Colour: hotspot risk level
          </p>
        </div>

        <DetailsPanel
          file={selectedFile}
          projectSummary={projectSummary}
          onBack={() =>
            setSelectedFile(null)
          }
        />
      </div>

      <div className="refactoring-section">
        <div className="refactoring-heading">
          <div>
            <h2>
              Refactoring Priority
            </h2>

            <p>
              Files ordered by descending
              refactoring priority score.
            </p>
          </div>

          <span>
            Top{" "}
            {refactoringCandidates.length}
          </span>
        </div>

        <RefactoringTable
          files={refactoringCandidates}
          selectedFile={selectedFile}
          onSelectFile={setSelectedFile}
        />
      </div>
    </section>
  );
}

function DetailsPanel({
  file,
  projectSummary,
  onBack
}) {
 
  if (!file) {
    return (
      <aside className="dashboard-panel hotspot-details-panel">
        <div className="hotspot-details-header">
          <h2>Project Details</h2>

          <span className="risk-badge project">
            Project
          </span>
        </div>

        <p className="hotspot-project-description">
          Aggregated hotspot metrics for all
          eligible source files.
        </p>

        <div className="hotspot-primary-score">
          <span>
            Project Hotspot Score
          </span>

          <strong>
            {formatNumber(
              projectSummary.hotspotScore
            )}
          </strong>
        </div>

        <div className="hotspot-details-grid">
          <DetailItem
            label="Eligible Files"
            value={
              projectSummary.fileCount
            }
          />

          <DetailItem
            label="Avg Commits / File"
            value={
              projectSummary.averageCommits
            }
          />

          <DetailItem
            label="Avg Churn / File"
            value={
              projectSummary.averageChurn
            }
          />

          <DetailItem
            label="Avg Authors / File"
            value={
              projectSummary.averageAuthors
            }
          />

          <DetailItem
            label="Total Lines of Code"
            value={
              projectSummary.totalLoc
            }
          />

          <DetailItem
            label="Total Complexity"
            value={
              projectSummary.totalComplexity
            }
          />

          <DetailItem
            label="Avg Complexity Score"
            value={
              projectSummary
                .averageComplexityScore
            }
          />

          <DetailItem
            label="Avg Git Activity"
            value={
              projectSummary
                .averageGitActivity
            }
          />
        </div>
      </aside>
    );
  }

  const riskLevel =
    file.hotspot_risk_level ||
    "Unknown";

  return (
    <aside className="dashboard-panel hotspot-details-panel">
      <div className="hotspot-details-header">
        <h2>File Details</h2>

        <span
          className={`risk-badge ${getRiskClass(
            riskLevel
          )}`}
        >
          {riskLevel}
        </span>
      </div>

      <p
        className="hotspot-file-path"
        title={file.path}
      >
        {file.path || "Unknown file"}
      </p>

      <div className="hotspot-primary-score">
        <span>Hotspot Score</span>

        <strong>
          {formatNumber(
            file.hotspot_score
          )}
        </strong>
      </div>

      <div className="hotspot-details-grid">
        <DetailItem
          label="Commits"
          value={file.commit_count}
        />

        <DetailItem
          label="Churn"
          value={file.churn}
        />

        <DetailItem
          label="Authors"
          value={file.authors_count}
        />

        <DetailItem
          label="Lines of Code"
          value={getFileLoc(file)}
        />

        <DetailItem
          label="Complexity"
          value={
            getFileComplexity(file)
          }
        />

        <DetailItem
          label="Complexity Score"
          value={
            file.complexity_score
          }
        />

        <DetailItem
          label="Git Activity"
          value={
            file.git_activity_score
          }
        />

        <DetailItem
          label="Refactoring Score"
          value={
            file.refactoring_priority_score
          }
        />
      </div>

      <button
  type="button"
  className="hotspot-back-link"
  onClick={onBack}
>
  ← Back to Project Details
</button>
    </aside>
  );
}

function DetailItem({
  label,
  value
}) {
  return (
    <div className="hotspot-detail-item">
      <span>{label}</span>

      <strong>
        {formatNumber(value)}
      </strong>
    </div>
  );
}

function RefactoringTable({
  files,
  selectedFile,
  onSelectFile
}) {
  if (files.length === 0) {
    return (
      <div className="refactoring-empty">
        No refactoring candidates are
        available.
      </div>
    );
  }

  return (
    <div className="refactoring-table-wrapper">
      <table className="refactoring-table">
        <thead>
          <tr>
            <th>File</th>
            <th>Hotspot</th>
            <th>Structure</th>
            <th>Quality</th>
            <th>High-TD</th>
            <th>Refactoring Score</th>
            <th>Level</th>
          </tr>
        </thead>

        <tbody>
          {files.map(
            (file, index) => {
              const isSelected =
                selectedFile &&
                (
                  selectedFile.id ===
                    file.id ||
                  selectedFile.path ===
                    file.path
                );

              return (
                <tr
                  key={
                    file.id ||
                    file.path ||
                    index
                  }
                  className={
                    isSelected
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    onSelectFile(file)
                  }
                >
                  <td
                    className="refactoring-file-cell"
                    title={file.path}
                  >
                    <span>
                      #{index + 1}
                    </span>

                    {shortenPath(
                      file.path
                    )}
                  </td>
<td>
  {formatNumber(file.hotspot_score)}
</td>

<td>
  {formatNumber(
    file.structural_risk_score
  )}
</td>

<td>
  {formatNumber(
    file.quality_risk_score
  )}
</td>

<td>
  {formatNumber(
    file.high_td_risk_score
  )}
</td>

<td className="refactoring-score-cell">
  {formatNumber(
    file.refactoring_priority_score
  )}
</td>
<td>
  <span
    className={`risk-badge ${getRiskClass(
      file.refactoring_priority_level ||
        file.final_risk_level
    )}`}
  >
    {file.refactoring_priority_level ||
      file.final_risk_level ||
      "-"}
  </span>
</td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}

function getFileLoc(file) {
  if (isTrue(file?.has_sonar_data)) {
    return Number(
      file.sonar_ncloc
    ) || 0;
  }

  if (
    isTrue(file?.has_allincode_data)
  ) {
    return Number(
      file.allincode_loc
    ) || 0;
  }

  return null;
}

function getFileComplexity(file) {
  if (isTrue(file?.has_sonar_data)) {
    return Number(
      file.sonar_complexity
    ) || 0;
  }

  if (
    isTrue(file?.has_allincode_data)
  ) {
    return Number(
      file.allincode_complexity
    ) || 0;
  }

  return null;
}

function getAverage(
  files,
  valueGetter
) {
  const values = files
    .map(valueGetter)
    .map(Number)
    .filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  );

  return total / values.length;
}

function getTotal(
  files,
  valueGetter
) {
  const values = files
    .map(valueGetter)
    .map(Number)
    .filter(Number.isFinite);

  if (values.length === 0) {
    return null;
  }

  return values.reduce(
    (sum, value) => sum + value,
    0
  );
}

function firstNumber(...values) {
  for (const value of values) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    const numberValue =
      Number(value);

    if (
      Number.isFinite(numberValue)
    ) {
      return numberValue;
    }
  }

  return null;
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

  const numberValue =
    Number(value);

  if (
    Number.isNaN(numberValue)
  ) {
    return "-";
  }

  return numberValue.toLocaleString(
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

  if (value.length <= 65) {
    return value;
  }

  return `...${value.slice(-62)}`;
}

function getRiskClass(value) {
  return String(
    value || "unknown"
  )
    .trim()
    .toLowerCase();
}

 
export default HotspotsSection;