// charts.js -- magnitude distribution and 7-day trend. Chart.js is loaded
// globally via a <script> tag in index.html (see index.html for why).
import { magnitudeLegend } from "./utils.js";
import { cssVar } from "./theme.js";

let magnitudeChart = null;
let trendChart = null;

// Chart.js draws to <canvas>, which can't read CSS variables itself -- so
// pull the live theme colors in whenever options are built or the theme flips.
function gridColor() {
  return cssVar("--hairline") || "#2b3340";
}
function textColor() {
  return cssVar("--ink-muted") || "#9ba5b4";
}
function signalColor() {
  return cssVar("--signal") || "#4fd8c4";
}

export function refreshChartTheme() {
  [magnitudeChart, trendChart].forEach((chart) => {
    if (!chart) return;
    Object.values(chart.options.scales).forEach((scale) => {
      if (scale.grid && scale.grid.display !== false) scale.grid.color = gridColor();
      if (scale.ticks) scale.ticks.color = textColor();
    });
    chart.options.plugins.legend.labels.color = textColor();
    chart.update("none");
  });
  if (trendChart) {
    const line = trendChart.data.datasets[0];
    line.borderColor = signalColor();
    line.backgroundColor = hexToRgba(signalColor(), 0.12);
    trendChart.update("none");
  }
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

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
          borderColor: signalColor(),
          backgroundColor: hexToRgba(signalColor(), 0.12),
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
    x: { grid: { color: gridColor() }, ticks: { color: textColor() } },
    y: {
      grid: { color: gridColor() },
      ticks: { color: textColor(), precision: 0 },
      beginAtZero: true,
    },
  };
  if (dualAxis) {
    scales.y1 = {
      position: "right",
      grid: { display: false },
      ticks: { color: textColor() },
      beginAtZero: true,
    };
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: { legend: { display: legend, labels: { color: textColor(), boxWidth: 12 } } },
    scales,
  };
}
