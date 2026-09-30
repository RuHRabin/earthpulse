// charts.js -- magnitude distribution and 7-day trend. Chart.js is loaded
// globally via a <script> tag in index.html (see index.html for why).
import { magnitudeLegend } from "./utils.js";

let magnitudeChart = null;
let trendChart = null;

const GRID_COLOR = "rgba(231, 235, 239, 0.08)";
const TEXT_COLOR = "#9ba5b4";

export function renderCharts(data) {
  renderMagnitudeChart(data.magnitude_distribution_week || {});
  renderTrendChart(data.daily_trend_7d || []);
}

function renderMagnitudeChart(distribution) {
  const bands = magnitudeLegend();
  const labels = bands.map((b) => `M${b.label}`);
  const values = bands.map((b) => distribution[b.label] || 0);
  const colors = bands.map((b) => b.color);

  const config = {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Earthquakes", data: values, backgroundColor: colors, borderRadius: 3 }],
    },
    options: baseOptions({ legend: false }),
  };

  if (magnitudeChart) {
    magnitudeChart.data = config.data;
    magnitudeChart.update();
  } else {
    magnitudeChart = new Chart(document.getElementById("magnitude-chart"), config);
  }
}

function renderTrendChart(trend) {
  const config = {
    type: "line",
    data: {
      labels: trend.map((t) => formatShortDate(t.date)),
      datasets: [
        {
          label: "Earthquakes",
          data: trend.map((t) => t.count),
          borderColor: "#4fd8c4",
          backgroundColor: "rgba(79, 216, 196, 0.12)",
          tension: 0.25,
          fill: true,
          yAxisID: "y",
        },
        {
          label: "Strongest",
          data: trend.map((t) => t.max_magnitude),
          borderColor: "#d2603f",
          tension: 0.25,
          yAxisID: "y1",
          pointRadius: 3,
        },
      ],
    },
    options: baseOptions({ legend: true, dualAxis: true }),
  };

  if (trendChart) {
    trendChart.data = config.data;
    trendChart.update();
  } else {
    trendChart = new Chart(document.getElementById("trend-chart"), config);
  }
}

function formatShortDate(dateStr) {
  const [, month, day] = dateStr.split("-");
  return `${month}/${day}`;
}

function baseOptions({ legend = true, dualAxis = false } = {}) {
  const scales = {
    x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR } },
    y: {
      grid: { color: GRID_COLOR },
      ticks: { color: TEXT_COLOR, precision: 0 },
      beginAtZero: true,
    },
  };
  if (dualAxis) {
    scales.y1 = {
      position: "right",
      grid: { display: false },
      ticks: { color: TEXT_COLOR },
      beginAtZero: true,
    };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: legend, labels: { color: TEXT_COLOR, boxWidth: 12 } } },
    scales,
  };
}
