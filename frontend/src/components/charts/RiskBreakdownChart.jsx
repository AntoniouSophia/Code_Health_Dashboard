import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
} from "chart.js";

import { Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
);

function RiskBreakdownChart({ run }) {
  const labels = [
    "Technical Debt",
    "Complexity",
    "Quality",
    "Duplication",
    "Hotspots",
    "Structure",
    "High-TD"
  ];

  const values = [
    run?.technical_debt_project_risk,
    run?.complexity_project_risk,
    run?.quality_project_risk,
    run?.duplication_project_risk,
    run?.hotspot_project_risk,
    run?.structural_project_risk,
    run?.high_td_project_risk
  ].map((value) => Number(value) || 0);

  const data = {
    labels,

    datasets: [
      {
        label: "Risk Score",
        data: values,
        backgroundColor: "#252267",
        borderRadius: 7,
        maxBarThickness: 48
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
      legend: {
        display: false
      },

      tooltip: {
        callbacks: {
          label(context) {
            return `Risk: ${Number(
              context.raw
            ).toFixed(2)}`;
          }
        }
      }
    },

    scales: {
      y: {
        beginAtZero: true,
        max: 100,

        ticks: {
          stepSize: 20
        },

        title: {
          display: true,
          text: "Risk Score"
        }
      },

      x: {
        ticks: {
          maxRotation: 35,
          minRotation: 0
        }
      }
    }
  };

  return (
    <div className="risk-chart-wrapper">
      <Bar
        data={data}
        options={options}
      />
    </div>
  );
}

export default RiskBreakdownChart;