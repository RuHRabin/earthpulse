// map.js -- the live earthquake map. Leaflet is loaded globally via a
// <script> tag in index.html (see the note in that file about why this
// project doesn't use a bundler), so `L` is available as a global here.
import { escapeHtml, formatDateTime, magnitudeColor, magnitudeLegend, magnitudeRadius } from "./utils.js";

let map = null;
let markerLayer = null;

export function renderMap(data) {
  if (!map) {
    map = L.map("quake-map", {
      worldCopyJump: true,
      scrollWheelZoom: false,
      minZoom: 2,
    }).setView([15, 10], 2);

    // A dark basemap is a genuine convention in real seismic-monitoring
    // tools (not just a stylistic default) -- it lets colored magnitude
    // markers read clearly against it.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);
    renderLegend();
  }

  markerLayer.clearLayers();

  const quakes = data.today_quakes || [];
  quakes.forEach((quake) => {
    if (quake.lat == null || quake.lon == null) return;
    const color = magnitudeColor(quake.mag);
    const marker = L.circleMarker([quake.lat, quake.lon], {
      radius: magnitudeRadius(quake.mag),
      color,
      fillColor: color,
      fillOpacity: 0.55,
      weight: 1,
    });
    marker.bindPopup(buildPopup(quake));
    markerLayer.addLayer(marker);
  });
}

function buildPopup(quake) {
  const magText = quake.mag != null ? quake.mag.toFixed(1) : "?";
  const depthText = quake.depth_km != null ? `${quake.depth_km.toFixed(1)} km` : "\u2014";
  const detailLink = quake.url
    ? `<a href="${quake.url}" target="_blank" rel="noopener">USGS event page</a>`
    : "";
  return `
    <div class="map-popup">
      <strong>M${magText}</strong> \u2014 ${escapeHtml(quake.place || "Unknown location")}
      <div>Depth: ${depthText}</div>
      <div>${formatDateTime(quake.time)}</div>
      ${quake.tsunami ? '<div class="popup-tsunami">Tsunami flag set</div>' : ""}
      ${detailLink}
    </div>`;
}

function renderLegend() {
  const legend = document.getElementById("map-legend");
  legend.innerHTML = magnitudeLegend()
    .map(
      (band) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${band.color}"></span>M${band.label}</span>`
    )
    .join("");
}
