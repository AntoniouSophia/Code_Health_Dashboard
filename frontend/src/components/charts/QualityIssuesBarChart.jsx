import { useMemo } from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
);

const RISK_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  unknown: "#9ca3af"
};

function QualityIssuesBarChart({ files }) {
  const chartFiles = useMemo(() => {
    const safeFiles =
      Array.isArray(files)
        ? files
        : [];

    return safeFiles
      .slice()
      .sort(
        (a, b) =>
          Number(
            b.quality_risk_score || 0
          ) -
          Number(
            a.quality_risk_score || 0
          )
      )
      .slice(0, 10);
  }, [files]);

  const data = {
    labels: chartFiles.map((file) =>
      shortenPath(file.path)
    ),

    datasets: [
      {
        label: "Quality Risk",

        data: chartFiles.map(
          (file) =>
            Number(
              file.quality_risk_score
            ) || 0
        ),

        backgroundColor:
          chartFiles.map((file) => {
            const severity =
              getSeverity(
                file.quality_risk_level,
                file.quality_risk_score
              );

            return (
              RISK_COLORS[severity] ||
              RISK_COLORS.unknown
            );
          }),

        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 28
      }
    ]
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false
      },

      tooltip: {
        callbacks: {
          title(context) {
            const index =
              context[0]?.dataIndex;

            return (
              chartFiles[index]?.path ||
              "Unknown file"
            );
          },

          label(context) {
            const file =
              chartFiles[
                context.dataIndex
              ] || {};

            return [
              `Quality risk: ${formatNumber(
                file.quality_risk_score
              )}`,

              `Code smells: ${formatNumber(
                file.sonar_code_smells
              )}`,

              `Bugs: ${formatNumber(
                file.sonar_bugs
              )}`,

              `Level: ${
                file.quality_risk_level ||
                "Unknown"
              }`
            ];
          }
        }
      }
    },

    scales: {
      x: {
        beginAtZero: true,
        max: 100,

        ticks: {
          stepSize: 20
        },

        title: {
          display: true,
          text: "Quality Risk Score",
          font: {
            weight: "bold"
          }
        },

        grid: {
          color:
            "rgba(107, 114, 128, 0.18)"
        }
      },

      y: {
        grid: {
          display: false
        },

        ticks: {
          color: "#374151",
          font: {
            size: 11
          }
        }
      }
    }
  };

  if (chartFiles.length === 0) {
    return (
      <div className="quality-chart-empty">
        No quality data is available.
      </div>
    );
  }

  return (
    <div className="quality-chart-wrapper">
      <Bar
        data={data}
        options={options}
      />
    </div>
  );
}

function shortenPath(path) {
  if (!path) {
    return "Unknown file";
  }

  const normalizedPath =
    String(path).replace(/\\/g, "/");

  const parts =
    normalizedPath.split("/");

  if (parts.length <= 2) {
    return normalizedPath;
  }

  return `.../${parts
    .slice(-2)
    .join("/")}`;
}

function getSeverity(level, score) {
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

function formatNumber(value) {
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

export default QualityIssuesBarChart;