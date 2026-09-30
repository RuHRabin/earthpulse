// app.js -- entry point. Loads data/latest.json (regenerated every 15
// minutes by GitHub Actions -- see scripts/fetch_earthquake_data.py) and
// hands it to each panel's render function.
import { fetchJSON } from "./utils.js";
import { renderStats, updateLiveIndicator } from "./stats.js";
import { renderMap } from "./map.js";
import { renderCharts } from "./charts.js";
import { renderTable } from "./table.js";
import { renderAlerts } from "./alerts.js";

const DATA_URL = "data/latest.json";
const BROWSER_REFRESH_MS = 5 * 60 * 1000; // re-poll every 5 min in the open tab

async function load() {
  try {
    const data = await fetchJSON(DATA_URL);
    render(data);
  } catch (error) {
    console.error("EarthPulse: failed to load data/latest.json", error);
  }
}

function render(data) {
  updateLiveIndicator(data);
  renderStats(data);
  renderSignificantBanner(data);
  renderMap(data);
  renderCharts(data);
  renderTable(data);
  renderAlerts(data);
}

function renderSignificantBanner(data) {
  const banner = document.getElementById("significant-banner");
  const strongest = data.strongest_today;
  const hasExtremeWeather = (data.us_weather_alerts?.by_severity?.Extreme || 0) > 0;

  if (strongest && strongest.mag >= 6) {
    banner.classList.remove("hidden");
    banner.innerHTML = `Significant earthquake: <strong>M${strongest.mag.toFixed(1)}</strong> \u2014 ${escapeHtmlLocal(strongest.place || "location unknown")}`;
  } else if (hasExtremeWeather) {
    banner.classList.remove("hidden");
    banner.innerHTML = `Extreme severe weather alerts are active in the US \u2014 see Alerts below.`;
  } else {
    banner.classList.add("hidden");
  }
}

// Tiny local copy so this file has no import solely for one string escape.
function escapeHtmlLocal(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("current-year").textContent = new Date().getFullYear();

load();
setInterval(load, BROWSER_REFRESH_MS);
