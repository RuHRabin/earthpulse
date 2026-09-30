// utils.js -- small, shared helpers with no dependencies on the DOM
// structure of any one panel, so every other module can import from here
// without creating circular imports.

// The magnitude scale is drawn from topographic elevation-banding (the
// green-to-amber-to-rust gradient cartographers use for low-to-high
// terrain), repurposed here so color always encodes real information
// rather than acting as decoration.
const MAGNITUDE_SCALE = [
  { max: 3, color: "#7dd5a8", label: "<3" },
  { max: 4, color: "#c9d571", label: "3-4" },
  { max: 5, color: "#e8c468", label: "4-5" },
  { max: 6, color: "#e3914f", label: "5-6" },
  { max: 7, color: "#d2603f", label: "6-7" },
  { max: Infinity, color: "#b33a3a", label: "7+" },
];

export function magnitudeColor(mag) {
  if (mag == null) return "#6b7686";
  const band = MAGNITUDE_SCALE.find((b) => mag < b.max);
  return band ? band.color : MAGNITUDE_SCALE[MAGNITUDE_SCALE.length - 1].color;
}

// The top band (#b33a3a) and the "unknown magnitude" grey (#6b7686) are
// both dark enough that near-black label text fails WCAG AA contrast --
// every other band passes comfortably with dark text.
export function magnitudeTextColor(mag) {
  return mag == null || mag >= 7 ? "#ffffff" : "#12161d";
}

export function magnitudeRadius(mag) {
  if (mag == null) return 3;
  return Math.max(3, mag * 2.6);
}

export function magnitudeLegend() {
  return MAGNITUDE_SCALE.map((b) => ({ color: b.color, label: b.label }));
}

export function timeAgo(isoString) {
  if (!isoString) return "\u2014";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function formatDateTime(isoString) {
  if (!isoString) return "\u2014";
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export async function fetchJSON(path) {
  const res = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json();
}
