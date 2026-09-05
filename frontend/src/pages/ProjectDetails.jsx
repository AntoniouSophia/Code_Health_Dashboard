import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";

import DashboardSidebar from
  "../components/dashboard/DashboardSidebar";

import OverviewSection from
  "../components/dashboard/OverviewSection";

import HotspotsSection from
  "../components/dashboard/HotspotsSection";
  
import QualityStructureSection from
  "../components/dashboard/QualityStructureSection";

import AllFileMetricsSection from
  "../components/dashboard/AllFileMetricsSection";

  import TemporalEvolutionSection from
"../components/dashboard/TemporalEvolutionSection";
import "./ProjectDetails.css";

const API_BASE = "http://localhost:3000";

function ProjectDetails() {
 const location = useLocation();
const navigate = useNavigate();

const {
  projectId,
  analysisRunId: routeAnalysisRunId
} = useParams();

  const lastRequestKey = useRef(null);

  const [databaseResult, setDatabaseResult] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [activeSection, setActiveSection] =
    useState("overview");

  let urlFromRoute = "";

  try {
    urlFromRoute = decodeURIComponent(
      projectId || ""
    );
  } catch {
    urlFromRoute = projectId || "";
  }

  const url =
    location.state?.url ||
    urlFromRoute;


const savedAnalysisRunId =
  routeAnalysisRunId ||
  location.state?.analysisRunId ||
  null;

const navigationMode =
  savedAnalysisRunId
    ? "view"
    : "analyze";

  const requestId =
    location.state?.requestId ||
    null;

  useEffect(() => {
    if (
  navigationMode === "analyze" &&
  !url
) {
  setError(
    "No repository URL was provided."
  );

  return;
}

if (
  navigationMode === "view" &&
  !savedAnalysisRunId
) {
  setError(
    "No saved analysis run was provided."
  );

  return;
}

    const requestKey =
      navigationMode === "view"
        ? `view:${savedAnalysisRunId}`
        : `analyze:${url}:${requestId || "default"}`;


    if (
      lastRequestKey.current ===
      requestKey
    ) {
      return;
    }

    lastRequestKey.current =
      requestKey;

    async function loadDatabaseResult(
      analysisRunId
    ) {
      const response = await fetch(
        `${API_BASE}/api/analysis-runs/${analysisRunId}`
      );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
          "Failed to load the saved database result."
        );
      }

      return payload;
    }

    async function loadProject() {
      setLoading(true);
      setError(null);
      setDatabaseResult(null);

      try {

        if (
          navigationMode === "view"
        ) {
          if (!savedAnalysisRunId) {
            throw new Error(
              "No saved analysis run was provided."
            );
          }

          const savedResult =
            await loadDatabaseResult(
              savedAnalysisRunId
            );

          setDatabaseResult(
            savedResult
          );

          return;
        }


        const analysisResponse =
          await fetch(
            `${API_BASE}/dashboard-preview-from-url`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({
                url
              })
            }
          );

        const analysisPayload =
          await analysisResponse.json();

        if (!analysisResponse.ok) {
          throw new Error(
            analysisPayload.error ||
            "Analysis failed."
          );
        }

       const analysisRunId =
  analysisPayload?.database
    ?.analysis_run_id;

if (!analysisRunId) {
  throw new Error(
    "The analysis completed, but no analysis run ID was returned."
  );
}

navigate(
  `/analysis/${analysisRunId}`,
  {
    replace: true
  }
);

return;
      } catch (requestError) {
        console.error(
          "Project loading failed:",
          requestError
        );

        setError(
          requestError.message ||
          "The project could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProject();
  }, [
  url,
  navigationMode,
  savedAnalysisRunId,
  requestId,
  navigate
]);

 if (
  navigationMode === "analyze" &&
  !url
) {
  return (
    <StatusMessage
      title="Repository URL missing"
      message="No repository URL was provided."
      type="error"
    />
  );
}

  if (loading) {
    return (
      <StatusMessage
        title={
          navigationMode === "view"
            ? "Loading saved project..."
            : "Analyzing project..."
        }
        message={
          navigationMode === "view" ? (
            <>
              <p>
                The saved analysis result is
                being loaded from MariaDB.
              </p>
            </>
          ) : (
            <>
              <p>
                SonarQube, Git, AllinCode and
                the scoring pipeline are running.
              </p>

              <p>
                The dashboard will display the
                values stored in MariaDB when the
                analysis finishes.
              </p>
            </>
          )
        }
      />
    );
  }

  if (error) {
    return (
      <StatusMessage
        title="Project loading failed"
        message={error}
        type="error"
      />
    );
  }

  if (!databaseResult) {
    return null;
  }

  const project =
    databaseResult.project || {};

  const run =
    databaseResult.analysis_run || {};

  const fileMetrics =
    databaseResult.merged_file_metrics || [];

  const trendHistory =
  Array.isArray(
    databaseResult.trend_history
  )
    ? databaseResult.trend_history
    : [];

  return (
    <div className="dashboard-layout">
      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main className="dashboard-main">
        {activeSection === "overview" && (
          <OverviewSection
            project={project}
            run={run}
            fileMetrics={fileMetrics}
          />
        )}

       {activeSection === "temporal" && (
  <TemporalEvolutionSection
  trendHistory={trendHistory}
  run={run}
  fileMetrics={fileMetrics}
/>
)}

        {activeSection === "hotspots" && (
          <HotspotsSection
            fileMetrics={fileMetrics}
            run={run}
/>
)}

      {activeSection === "quality" && (
          <QualityStructureSection
           fileMetrics={fileMetrics}
          />
          )}

        {activeSection === "files" && (
  <AllFileMetricsSection
    fileMetrics={fileMetrics}
  />
)}
      </main>
    </div>
  );
}


function StatusMessage({
  title,
  message,
  type = "normal"
}) {
  const isError =
    type === "error";

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px",
        fontFamily:
          "Arial, sans-serif",
        backgroundColor: "#eef1ff"
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          padding: "25px",

          border: `3px solid ${
            isError
              ? "#dc2626"
              : "#312e81"
          }`,

          borderRadius: "20px",
          backgroundColor: "#ffffff"
        }}
      >
        <h1
          style={{
            marginTop: 0,

            color: isError
              ? "#dc2626"
              : "#312e81"
          }}
        >
          {title}
        </h1>

        <div
          style={{
            color: isError
              ? "#b91c1c"
              : "#374151",

            fontWeight: isError
              ? "bold"
              : "normal"
          }}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

export default ProjectDetails;