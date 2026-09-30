// map.js -- the live earthquake map. Leaflet, MapLibre GL, and the
// maplibre-gl-leaflet bridge are all loaded globally via <script> tags in
// index.html (see the note in that file about why this project doesn't
// use a bundler), so `L` and the MapLibre globals are available here.
//
// The basemap is OpenFreeMap's "dark" vector style, rendered by MapLibre
// GL and bridged into this Leaflet map -- NOT a plain Leaflet raster
// tileLayer. That's a deliberate, slightly more complex choice: CARTO's
// free raster dark tiles (basemaps.cartocdn.com), which this project used
// originally, started requiring an API key in August 2026. OpenFreeMap is
// currently free, keyless, and has no published request limit. If it ever
// changes too, swap the `style:` URL below (or the whole layer) for
// whatever's current -- everything else in this file (markers, popups,
// legend) is independent of the basemap and doesn't need to change.
import { escapeHtml, formatDateTime, magnitudeColor, magnitudeLegend, magnitudeRadius } from "./utils.js";

const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const BASEMAP_ATTRIBUTION =
  'Basemap &copy; <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

let map = null;
let markerLayer = null;

export function renderMap(data) {
  if (!map) {
    map = L.map("quake-map", {
      worldCopyJump: true,
      scrollWheelZoom: false,
      minZoom: 2,
      // MapLibre GL (unlike Leaflet's own raster tiles) can misbehave if a
      // user pans/zooms out past the poles, per the maplibre-gl-leaflet
      // project's own example -- constrain to valid Web Mercator latitudes
      // as a defensive measure. Longitude is left open since
      // worldCopyJump already handles horizontal wrapping.
      maxBounds: [
        [-85, -Infinity],
        [85, Infinity],
      ],
    }).setView([15, 10], 2);

    L.maplibreGL({
      style: BASEMAP_STYLE_URL,
      attribution: BASEMAP_ATTRIBUTION,
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
