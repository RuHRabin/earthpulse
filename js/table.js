// table.js -- the significant earthquakes list (M4.5+, past 30 days),
// with client-side search and a minimum-magnitude filter.
import { escapeHtml, formatDateTime, magnitudeColor, magnitudeTextColor } from "./utils.js";

let allQuakes = [];
let listenersAttached = false;

export function renderTable(data) {
  allQuakes = data.significant_recent || [];
  attachListenersOnce();
  applyFilters();
}

function attachListenersOnce() {
  if (listenersAttached) return;
  document.getElementById("quake-search").addEventListener("input", applyFilters);
  document.getElementById("magnitude-filter").addEventListener("change", applyFilters);
  listenersAttached = true;
}

function applyFilters() {
  const search = document.getElementById("quake-search").value.trim().toLowerCase();
  const minMag = parseFloat(document.getElementById("magnitude-filter").value || "0");
  const filtered = allQuakes.filter(
    (q) => (q.place || "").toLowerCase().includes(search) && (q.mag || 0) >= minMag
  );
  renderRows(filtered);
}

function renderRows(quakes) {
  const tbody = document.getElementById("quake-table-body");

  if (!quakes.length) {
    // Distinguish "nothing has synced yet" from "your filters excluded
    // everything" -- these need different messages or the empty state reads
    // as a bug rather than an honest reflection of what's happened.
    const message = allQuakes.length === 0
      ? "No data yet \u2014 waiting for the first automatic sync."
      : "No earthquakes match your filters.";
    tbody.innerHTML = `<tr><td colspan="5" class="empty-row">${message}</td></tr>`;
    return;
  }

  tbody.innerHTML = quakes
    .map((quake) => {
      const magText = quake.mag != null ? quake.mag.toFixed(1) : "?";
      const depthText = quake.depth_km != null ? `${quake.depth_km.toFixed(1)} km` : "\u2014";
      const detail = quake.url
        ? `<a href="${quake.url}" target="_blank" rel="noopener" aria-label="USGS event details">${externalLinkIcon()}</a>`
        : "";
      return `
        <tr>
          <td><span class="mag-badge" style="background:${magnitudeColor(quake.mag)};color:${magnitudeTextColor(quake.mag)}">${magText}</span></td>
          <td>${escapeHtml(quake.place || "Unknown location")}${quake.tsunami ? " \uD83C\uDF0A" : ""}</td>
          <td>${depthText}</td>
          <td>${formatDateTime(quake.time)}</td>
          <td class="table-link-cell">${detail}</td>
        </tr>`;
    })
    .join("");
}

function externalLinkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
}
