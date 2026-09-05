import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

function TemporalDebtChart({
  trendHistory = []
}) {
  const sortedHistory = [
    ...trendHistory
  ].sort((firstRun, secondRun) => {
    const firstDate =
      new Date(firstRun.run_date);

    const secondDate =
      new Date(secondRun.run_date);

    return firstDate - secondDate;
  });

  if (sortedHistory.length === 0) {
    return (
      <div className="temporal-chart-empty">
        No historical analysis data is
        available yet.
      </div>
    );
  }

  const labels = sortedHistory.map(
    (historyItem) =>
      formatChartDate(
        historyItem.run_date
      )
  );

  const technicalDebtValues =
    sortedHistory.map(
      (historyItem) =>
        optionalNumber(
          historyItem
            .sonar_technical_debt_days
        )
    );

  const allinCodeCostValues =
    sortedHistory.map(
      (historyItem) =>
        optionalNumber(
          historyItem.allincode_cost
        )
    );

  const chartData = {
    labels,

    datasets: [
      {
        label:
          "Sonar Technical Debt Days",

        data: technicalDebtValues,

        yAxisID: "technicalDebtAxis",

        borderColor: "#312e81",
        backgroundColor:
          "rgba(57, 120, 233, 0.14)",

        pointBackgroundColor:
          "#312e81",

        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,

        borderWidth: 3,
        tension: 0.28,

        spanGaps: true
      },

      {
        label: "AllinCode Cost",

        data: allinCodeCostValues,

        yAxisID: "allinCodeAxis",

        borderColor: "#872e5d",
        backgroundColor:
          "rgba(155, 116, 223, 0.14)",

        pointBackgroundColor:
          "#872e5d",

        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,

        borderWidth: 3,
        tension: 0.28,

        spanGaps: true
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      mode: "index",
      intersect: false
    },

    plugins: {
      legend: {
        position: "bottom",

        labels: {
          usePointStyle: true,
          boxWidth: 10,
          boxHeight: 10,
          padding: 20,

          color: "#4b4f62",

          font: {
            size: 12,
            weight: "bold"
          }
        }
      },

      tooltip: {
        padding: 12,

        callbacks: {
          title(tooltipItems) {
            const dataIndex =
              tooltipItems[0]
                ?.dataIndex;

            const historyItem =
              sortedHistory[
                dataIndex
              ];

            return formatFullDate(
              historyItem?.run_date
            );
          },

          label(context) {
            const historyItem =
              sortedHistory[
                context.dataIndex
              ];

            const numericValue =
              optionalNumber(
                context.raw
              );

            if (
              context.dataset.yAxisID ===
              "technicalDebtAxis"
            ) {
              return (
                ` Technical Debt: ` +
                `${formatNumber(
                  numericValue
                )} days`
              );
            }

            return (
              ` AllinCode Cost: ` +
              `${formatCurrency(
                numericValue
              )}`
            );
          },

          afterBody(tooltipItems) {
            const dataIndex =
              tooltipItems[0]
                ?.dataIndex;

            const historyItem =
              sortedHistory[
                dataIndex
              ];

            if (!historyItem) {
              return [];
            }

            const lines = [];

            if (
              historyItem
                .commit_sha
            ) {
              lines.push(
                `Commit: ${shortSha(
                  historyItem
                    .commit_sha
                )}`
              );
            }

            const healthScore =
              optionalNumber(
                historyItem
                  .global_health_score
              );

            if (healthScore !== null) {
              lines.push(
                `Global Health: ${formatNumber(
                  healthScore
                )}/100`
              );
            }


            return lines;
          }
        }
      }
    },

    scales: {
      x: {
        grid: {
          display: false
        },

        ticks: {
          color: "#65697c",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      },

      technicalDebtAxis: {
        type: "linear",
        position: "left",
        beginAtZero: true,

       

        ticks: {
          color: "#312e81"
        },

        grid: {
          color:
            "rgba(107, 114, 128, 0.18)"
        }
      },

      allinCodeAxis: {
        type: "linear",
        position: "right",
        beginAtZero: true,

        

        ticks: {
          color: "#872e5d",

          callback(value) {
            return compactNumber(
              value
            );
          }
        },

        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  return (
    <div className="temporal-chart-container">
      <Line
        data={chartData}
        options={chartOptions}
      />
    </div>
  );
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

function compactNumber(value) {
  const numericValue =
    optionalNumber(value);

  if (numericValue === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      notation: "compact",
      maximumFractionDigits: 1
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

function formatChartDate(value) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value || "—");
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit"
    }
  ).format(date);
}

function formatFullDate(value) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return String(value || "Unknown date");
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}

function shortSha(value) {
  const sha = String(
    value || ""
  );

  return sha.length > 10
    ? sha.slice(0, 10)
    : sha;
}

export default TemporalDebtChart;