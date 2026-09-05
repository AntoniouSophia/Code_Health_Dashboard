import { useMemo } from "react";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

import { Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

const SEVERITIES = [
  {
    key: "critical",
    label: "Critical",
    color: "#ef4444"
  },
  {
    key: "high",
    label: "High",
    color: "#f97316"
  },
  {
    key: "medium",
    label: "Medium",
    color: "#eab308"
  },
  {
    key: "low",
    label: "Low",
    color: "#22c55e"
  }
];

function StructureSeverityChart({
  files
}) {
  const severityCounts =
    useMemo(() => {
      const safeFiles =
        Array.isArray(files)
          ? files
          : [];

      const counts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      };

      safeFiles.forEach((file) => {
        const severity =
          getSeverity(
            file.structural_risk_level,
            file.structural_risk_score
          );

        if (
          Object.hasOwn(
            counts,
            severity
          )
        ) {
          counts[severity] += 1;
        }
      });

      return counts;
    }, [files]);

  const total = Object.values(
    severityCounts
  ).reduce(
    (sum, count) => sum + count,
    0
  );

  const data = {
    labels: SEVERITIES.map(
      (item) => item.label
    ),

    datasets: [
      {
        data: SEVERITIES.map(
          (item) =>
            severityCounts[item.key]
        ),

        backgroundColor:
          SEVERITIES.map(
            (item) => item.color
          ),

        borderColor: "#ffffff",
        borderWidth: 3,
        hoverOffset: 8
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",

    plugins: {
      legend: {
        position: "bottom",

        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 16
        }
      },

      tooltip: {
        callbacks: {
          label(context) {
            const count =
              Number(context.raw) || 0;

            const percentage =
              total > 0
                ? (
                    (count / total) *
                    100
                  ).toFixed(1)
                : "0.0";

            return `${context.label}: ${count} (${percentage}%)`;
          }
        }
      }
    }
  };

  if (total === 0) {
    return (
      <div className="structure-chart-empty">
        No structural-risk data is
        available.
      </div>
    );
  }

  return (
    <div className="structure-chart-wrapper">
      <Doughnut
        data={data}
        options={options}
      />

      <div className="structure-chart-total">
        <strong>{total}</strong>
        <span>files</span>
      </div>
    </div>
  );
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
    return "low";
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

export default StructureSeverityChart;