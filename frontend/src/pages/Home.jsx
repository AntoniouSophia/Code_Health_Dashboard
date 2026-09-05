import {
  useEffect,
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import "./Home.css";

const API_BASE =
  "http://localhost:3000";

function Home() {
  const navigate = useNavigate();

  const [repoUrl, setRepoUrl] =
    useState("");

  const [projects, setProjects] =
    useState([]);

  const [loadingProjects, setLoadingProjects] =
    useState(true);

  const [error, setError] =
    useState(null);

  useEffect(() => {
    async function loadProjects() {
      setLoadingProjects(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/projects`
        );

        const payload =
          await response.json();

        if (!response.ok) {
          throw new Error(
            payload.error ||
            "Failed to load projects."
          );
        }

        setProjects(
          Array.isArray(payload.projects)
            ? payload.projects
            : []
        );
      } catch (requestError) {
        console.error(
          "Failed to load projects:",
          requestError
        );

        setError(
          requestError.message ||
          "Could not load saved projects."
        );
      } finally {
        setLoadingProjects(false);
      }
    }

    loadProjects();
  }, []);

  const isValidGitHubUrl = (value) => {
    try {
      const parsedUrl =
        new URL(value);

      return (
        parsedUrl.protocol === "https:" &&
        parsedUrl.hostname === "github.com" &&
        parsedUrl.pathname
          .split("/")
          .filter(Boolean)
          .length >= 2
      );
    } catch {
      return false;
    }
  };

  const startNewAnalysis = (
    repositoryUrl
  ) => {
    const cleanedUrl =
      repositoryUrl.trim();

    if (!cleanedUrl) {
      setError(
        "Please enter a GitHub repository URL."
      );

      return;
    }

    if (!isValidGitHubUrl(cleanedUrl)) {
      setError(
        "Please enter a valid GitHub repository URL."
      );

      return;
    }

    setError(null);

    const projectRoute =
      encodeURIComponent(cleanedUrl);

    navigate(
      `/project/${projectRoute}`,
      {
        state: {
          url: cleanedUrl,
          mode: "analyze",
          requestId: Date.now()
        }
      }
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    startNewAnalysis(repoUrl);
  };

 const openSavedProject = (
  project
) => {
  if (
    !project.latest_analysis_run_id
  ) {
    setError(
      "This project does not have a saved analysis run."
    );

    return;
  }

  navigate(
    `/analysis/${project.latest_analysis_run_id}`
  );
};

  const formatDate = (value) => {
    if (!value) {
      return "No analysis date";
    }

    const date = new Date(value);

    if (
      Number.isNaN(date.getTime())
    ) {
      return value;
    }

    return date.toLocaleString(
      "el-GR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
  };

  const formatScore = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }

    const numericValue =
      Number(value);

    if (
      Number.isNaN(numericValue)
    ) {
      return "-";
    }

    return numericValue.toFixed(1);
  };

  const getHealthClass = (score) => {
    const numericScore =
      Number(score);

    if (
      Number.isNaN(numericScore)
    ) {
      return "neutral";
    }

    if (numericScore >= 80) {
      return "very-good";
    }

    if (numericScore >= 65) {
      return "good";
    }

    if (numericScore >= 50) {
      return "moderate";
    }

    if (numericScore >= 35) {
      return "low";
    }

    return "critical";
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <h1>Health Dashboard</h1>

      </header>

      <main className="home-main">
        <section className="analysis-entry-section">
          <h2>Analyze a repository</h2>

          <form
            className="repository-form"
            onSubmit={handleSubmit}
          >
            <label
              htmlFor="repository-url"
            >
              URL:
            </label>

            <input
              id="repository-url"
              type="url"
              placeholder="https://github.com/owner/repository"
              value={repoUrl}
              onChange={(event) =>
                setRepoUrl(
                  event.target.value
                )
              }
            />

            <button
             type="submit"
            className="analyze-button"
            aria-label="Analyze repository"
            title="Analyze repository"
            >
           <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
           >
          <path
           d="M5 12h14M13 6l6 6-6 6"
          />
          </svg>
</button>
          </form>

          {error && (
            <p className="home-error">
              {error}
            </p>
          )}
        </section>

        <section className="recent-projects-section">
          <div className="recent-projects-heading">
            <div>
              <h2>Recent Projects</h2>

              <p>
                Open a saved result or run
                the analysis again.
              </p>
            </div>

            <span className="project-count">
              {projects.length}
              {" "}
              {projects.length === 1
                ? "project"
                : "projects"}
            </span>
          </div>

          {loadingProjects && (
            <div className="projects-message">
              Loading saved projects...
            </div>
          )}

          {!loadingProjects &&
            projects.length === 0 && (
              <div className="projects-message">
                No saved projects yet.
                Enter a GitHub URL to run
                the first analysis.
              </div>
            )}

          {!loadingProjects &&
            projects.length > 0 && (
              <div className="projects-list">
                {projects.map(
                  (project) => (
                   <article
  className="project-item"
  key={project.project_id}
>
  <button
    type="button"
    className="project-open-button"
    onClick={() =>
      openSavedProject(project)
    }
    disabled={
      !project.latest_analysis_run_id
    }
  >
    <span className="project-date">
      {formatDate(
        project.latest_run_date ||
        project.last_analyzed_at
      )}
    </span>

    <span className="project-information">
      <strong>
        {project.repo_name}
      </strong>

      <small>
        {project.owner}/
        {project.repo_name}
      </small>
    </span>

    <span className="project-scores">
      <span
        className={`health-score ${getHealthClass(
          project.global_health_score
        )}`}
      >
        Health{" "}
        {formatScore(
          project.global_health_score
        )}
      </span>

    
    </span>
  </button>

  <button
    type="button"
    className="reanalyze-button"
    title="Run a new analysis"
    aria-label={`Analyze ${project.repo_name} again`}
    onClick={() =>
      startNewAnalysis(
        project.repo_url
      )
    }
  >
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66" />
      <path d="M20 4v7h-7" />
    </svg>
  </button>
</article>
                  )
                )}
              </div>
            )}
        </section>
      </main>
    </div>
  );
}

export default Home;