// alerts.js -- active US severe weather alerts panel (National Weather
// Service). Regional by nature -- NWS only covers the United States.
import { escapeHtml } from "./utils.js";

const SEVERITY_COLOR = {
  Extreme: "#b33a3a",
  Severe: "#d2603f",
  Moderate: "#e8c468",
  Minor: "#7dd5a8",
  Unknown: "#6b7686",
};

// Mirrors magnitudeTextColor()'s reasoning: Extreme's background is dark
// enough that near-black text fails WCAG AA contrast (3.09:1) -- every
// other severity passes comfortably with dark text.
const SEVERITY_TEXT_COLOR = {
  Extreme: "#ffffff",
  Severe: "#12161d",
  Moderate: "#12161d",
  Minor: "#12161d",
  Unknown: "#ffffff",
};

export function renderAlerts(data) {
  const container = document.getElementById("alerts-container");
  const alerts = data.us_weather_alerts;

  if (!alerts || alerts.unavailable) {
    container.innerHTML = `<p class="empty-state">Weather alert data is temporarily unavailable.</p>`;
    return;
  }

  if (!alerts.active_count) {
    container.innerHTML = `<p class="empty-state">No active severe weather alerts in the US right now.</p>`;
    return;
  }

  const summary = Object.entries(alerts.by_severity)
    .sort((a, b) => severityRank(a[0]) - severityRank(b[0]))
    .map(
      ([severity, count]) =>
        `<span class="severity-pill" style="border-color:${colorFor(severity)}"><span class="severity-dot" style="background:${colorFor(severity)}"></span>${severity}: ${count}</span>`
    )
    .join("");

  const list = (alerts.top_alerts || [])
    .map(
      (alert) => `
      <div class="alert-item">
        <span class="alert-severity" style="background:${colorFor(alert.severity)};color:${textColorFor(alert.severity)}">${escapeHtml(alert.severity || "Unknown")}</span>
        <div class="alert-body">
          <strong>${escapeHtml(alert.event || "Alert")}</strong>
          <p>${escapeHtml(alert.area || "")}</p>
        </div>
      </div>`
    )
    .join("");

  container.innerHTML = `
    <div class="severity-summary">${summary}</div>
    <div class="alert-list">${list}</div>`;
}

function colorFor(severity) {
  return SEVERITY_COLOR[severity] || SEVERITY_COLOR.Unknown;
}

function textColorFor(severity) {
  return SEVERITY_TEXT_COLOR[severity] || SEVERITY_TEXT_COLOR.Unknown;
}

function severityRank(severity) {
  const order = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 };
  return order[severity] ?? 5;
}
