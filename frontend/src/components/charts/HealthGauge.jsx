import {
  Chart as ChartJS,
  ArcElement,
  Tooltip
} from "chart.js";

import { Doughnut } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip
);

const gaugeNeedlePlugin = {
  id: "gaugeNeedle",

  afterDatasetsDraw(chart) {

  if (chart.config.type !== "doughnut") {
    return;
  }



    const pluginOptions =
      chart.options.plugins?.gaugeNeedle;

    if (!pluginOptions) {
      return;
    }

    const value = Math.max(
      0,
      Math.min(
        100,
        Number(pluginOptions.value) || 0
      )
    );

    const firstArc =
      chart.getDatasetMeta(0)?.data?.[0];

    if (!firstArc) {
      return;
    }

    const {
      ctx
    } = chart;

    const centerX = firstArc.x;
    const centerY = firstArc.y;

    const needleLength =
      firstArc.outerRadius * 0.72;

    /*
     * 0   → αριστερά
     * 50  → επάνω
     * 100 → δεξιά
     */
    const angle =
      Math.PI +
      (value / 100) * Math.PI;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);

    ctx.lineTo(
      centerX +
        Math.cos(angle) *
          needleLength,
      centerY +
        Math.sin(angle) *
          needleLength
    );

    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#171717";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      9,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = "#171717";
    ctx.fill();


    ctx.restore();
  }
};


function HealthGauge({ score }) {
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Number(score) || 0
    )
  );

  const data = {
    labels: [
      "Critical",
      "Low",
      "Moderate",
      "Good"
    ],

    datasets: [
      {
        data: [
          25,
          25,
          25,
          25
        ],

        backgroundColor: [
          "#ef4444",
          "#f97316",
          "#facc15",
          "#22c55e"
        ],

        borderWidth: 0,
        circumference: 180,
        rotation: 270,
        cutout: "68%"
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
            return context.label;
          }
        }
      },

      gaugeNeedle: {
        value: healthScore
      }
    }
  };

  return (
    <div className="health-gauge-wrapper">
     <Doughnut
      data={data}
      options={options}
     plugins={[gaugeNeedlePlugin]}
    />

      <div className="health-gauge-label">
        <span>Global Health Score</span>

       <strong>
         {healthScore.toFixed(1)}%
      </strong>
     </div>
    </div>
  );
}

export default HealthGauge;