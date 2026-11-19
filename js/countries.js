// countries.js -- "Where it's shaking": the most active countries/regions
// over the past 7 days. Plain HTML bars (not a canvas) so every row is a
// real, keyboard-focusable button that filters the table below.
import { escapeHtml, magnitudeColor, magnitudeTextColor } from "./utils.js";
import { filterTableByCountry } from "./table.js";

let listenerAttached = false;

export function renderCountries(data) {
  const list = document.getElementById("country-list");
  const rows = data.by_country_week || [];

  if (!listenerAttached) {
    // One delegated listener survives the periodic re-render.
    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-country]");
      if (row) filterTableByCountry(row.dataset.country);
    });
    listenerAttached = true;
  }

  if (!rows.length) {
    list.innerHTML = `<li class="empty-row">No data yet — waiting for the first automatic sync.</li>`;
    return;
  }

  const maxCount = Math.max(...rows.map((r) => r.count));
  list.innerHTML = rows
    .map((r) => {
      const width = Math.max(3, Math.round((r.count / maxCount) * 100));
      const mag = r.max_magnitude;
      return `
        <li>
          <button type="button" class="country-row" data-country="${escapeHtml(r.country)}"
                  aria-label="${escapeHtml(r.country)}: ${r.count} earthquakes, strongest M${mag.toFixed(1)}. Filter table.">
            <span class="country-name">${escapeHtml(r.country)}</span>
            <span class="country-bar-track" aria-hidden="true">
              <span class="country-bar" style="width:${width}%;background:${magnitudeColor(mag)}"></span>
            </span>
            <span class="country-count">${r.count.toLocaleString()}</span>
            <span class="mag-badge" style="background:${magnitudeColor(mag)};color:${magnitudeTextColor(mag)}">${mag.toFixed(1)}</span>
          </button>
        </li>`;
    })
    .join("");
}
