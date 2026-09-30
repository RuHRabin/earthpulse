// stats.js -- the instrument-readout strip at the top of the page, and the
// live-status pulse in the header.
import { escapeHtml, timeAgo } from "./utils.js";

let liveIntervalId = null;

export function renderStats(data) {
  const grid = document.getElementById("stats-grid");
  const items = [
    { value: formatCount(data.counts?.today), label: "earthquakes today" },
    { value: formatCount(data.counts?.week), label: "earthquakes this week" },
    {
      value: data.strongest_today ? `M${data.strongest_today.mag.toFixed(1)}` : "\u2014",
      label: "strongest today",
      sub: data.strongest_today?.place,
    },
    {
      value: data.avg_magnitude_today != null ? data.avg_magnitude_today.toFixed(2) : "\u2014",
      label: "average magnitude today",
    },
    {
      value: formatCount(data.us_weather_alerts?.active_count),
      label: "active US weather alerts",
    },
  ];

  grid.innerHTML = items
    .map(
      (item) => `
      <div class="stat">
        <span class="stat-value">${item.value}</span>
        <span class="stat-label">${item.label}</span>
        ${item.sub ? `<span class="stat-sub">${escapeHtml(item.sub)}</span>` : ""}
      </div>`
    )
    .join("");
}

export function updateLiveIndicator(data) {
  const text = document.getElementById("last-updated-text");
  const dot = document.getElementById("live-dot");
  const banner = document.getElementById("sync-banner");

  if (liveIntervalId) {
    clearInterval(liveIntervalId);
    liveIntervalId = null;
  }

  if (!data.generated_at) {
    banner.classList.remove("hidden");
    text.textContent = "Awaiting first sync";
    dot.classList.add("dot-pending");
    return;
  }

  banner.classList.add("hidden");
  dot.classList.remove("dot-pending");
  const generatedAt = data.generated_at;
  const refresh = () => {
    text.textContent = `Updated ${timeAgo(generatedAt)}`;
  };
  refresh();
  liveIntervalId = setInterval(refresh, 30000);
}

function formatCount(value) {
  if (value == null) return "\u2014";
  return value.toLocaleString();
}
