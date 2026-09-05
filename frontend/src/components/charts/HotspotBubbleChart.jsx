import {
  useMemo,
  useRef
} from "react";

import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

import {
  Bubble,
  getElementAtEvent
} from "react-chartjs-2";

ChartJS.register(
  LinearScale,
  PointElement,
  Tooltip,
  Legend
);

const RISK_CONFIG = {
  Critical: {
    backgroundColor: "rgba(220, 38, 38, 0.70)",
    borderColor: "#991b1b"
  },

  High: {
    backgroundColor: "rgba(249, 115, 22, 0.70)",
    borderColor: "#c2410c"
  },

  Medium: {
    backgroundColor: "rgba(234, 179, 8, 0.70)",
    borderColor: "#a16207"
  },

  Low: {
    backgroundColor: "rgba(34, 197, 94, 0.65)",
    borderColor: "#15803d"
  },

  Unknown: {
    backgroundColor: "rgba(107, 114, 128, 0.55)",
    borderColor: "#4b5563"
  }
};

const RISK_ORDER = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Unknown"
];

function normalizeRiskLevel(value) {
  const normalized =
    String(value || "")
      .trim()
      .toLowerCase();

  if (normalized === "critical") {
    return "Critical";
  }

  if (normalized === "high") {
    return "High";
  }

  if (normalized === "medium") {
    return "Medium";
  }

  if (normalized === "low") {
    return "Low";
  }

  return "Unknown";
}

function getBubbleRadius(
  churn,
  maximumChurn
) {
  const numericChurn =
    Math.max(0, Number(churn) || 0);

  const numericMaximum =
    Math.max(
      0,
      Number(maximumChurn) || 0
    );

  const minimumRadius = 6;
  const maximumRadius = 22;

  if (numericMaximum === 0) {
    return minimumRadius;
  }

  /*
   * Logarithmic scaling:
   */
  const ratio =
    Math.log1p(numericChurn) /
    Math.log1p(numericMaximum);

  return (
    minimumRadius +
    ratio *
      (maximumRadius - minimumRadius)
  );
}

function HotspotBubbleChart({
  files,
  onSelectFile
}) {
  const chartRef = useRef(null);

  const chartData = useMemo(() => {
    const safeFiles =
      Array.isArray(files)
        ? files
        : [];

    const maximumChurn = Math.max(
      0,
      ...safeFiles.map(
        (file) =>
          Number(file.churn) || 0
      )
    );

    const datasets = RISK_ORDER.map(
      (riskLevel) => {
        const riskFiles =
          safeFiles.filter(
            (file) =>
              normalizeRiskLevel(
                file.hotspot_risk_level
              ) === riskLevel
          );

        const config =
          RISK_CONFIG[riskLevel];

        return {
          label: riskLevel,

          data: riskFiles.map(
            (file) => ({
              x:
                Number(
                  file.complexity_score
                ) || 0,

              y:
                Number(
                  file.commit_count
                ) || 0,

              r: getBubbleRadius(
                file.churn,
                maximumChurn
              ),

          
              file
            })
          ),

          backgroundColor:
            config.backgroundColor,

          borderColor:
            config.borderColor,

          borderWidth: 1.5,

          hoverBorderWidth: 3,
          hoverRadius: 3
        };
      }
    ).filter(
      (dataset) =>
        dataset.data.length > 0
    );

    return {
      datasets
    };
  }, [files]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: "nearest",
      intersect: true
    },

    plugins: {
      legend: {
        position: "top",

        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          padding: 18
        }
      },

      tooltip: {
        callbacks: {
          title(context) {
            const point =
              context[0]?.raw;

            return (
              point?.file?.path ||
              "Unknown file"
            );
          },

          label(context) {
            const file =
              context.raw?.file || {};

            return [
              `Hotspot: ${formatTooltipNumber(
                file.hotspot_score
              )}`,

              `Complexity score: ${formatTooltipNumber(
                file.complexity_score
              )}`,

              `Commits: ${formatTooltipNumber(
                file.commit_count
              )}`,

              `Churn: ${formatTooltipNumber(
                file.churn
              )}`,

              `Risk: ${
                file.hotspot_risk_level ||
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

        title: {
          display: true,
          text: "Complexity Score",
          font: {
            weight: "bold"
          }
        },

        grid: {
          color: "rgba(107, 114, 128, 0.18)"
        }
      },

      y: {
        beginAtZero: true,

        ticks: {
          precision: 0
        },

        title: {
          display: true,
          text: "Commit Count",
          font: {
            weight: "bold"
          }
        },

        grid: {
          color: "rgba(107, 114, 128, 0.18)"
        }
      }
    }
  };

  const handleChartClick = (event) => {
    if (!chartRef.current) {
      return;
    }

    const elements =
      getElementAtEvent(
        chartRef.current,
        event
      );

    if (elements.length === 0) {
      return;
    }

    const {
      datasetIndex,
      index
    } = elements[0];

    const selectedPoint =
      chartData
        .datasets[datasetIndex]
        ?.data[index];

    if (selectedPoint?.file) {
      onSelectFile?.(
        selectedPoint.file
      );
    }
  };

  if (
    chartData.datasets.length === 0
  ) {
    return (
      <div className="hotspot-chart-empty">
        No hotspot data is available.
      </div>
    );
  }

  return (
    <div className="hotspot-chart-wrapper">
      <Bubble
        ref={chartRef}
        data={chartData}
        options={options}
        onClick={handleChartClick}
      />
    </div>
  );
}

function formatTooltipNumber(value) {
  const numberValue =
    Number(value);

  if (
    Number.isNaN(numberValue)
  ) {
    return "-";
  }

  return numberValue.toFixed(2);
}

export default HotspotBubbleChart;