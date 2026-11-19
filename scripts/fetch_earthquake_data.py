#!/usr/bin/env python3
"""
EarthPulse data pipeline
=========================
Fetches live earthquake data from the USGS Earthquake Hazards Program and
active severe weather alerts from the US National Weather Service, then
writes a compact summary JSON that the static frontend reads directly.

Both APIs are free, public, and require no authentication or API key.
This script uses only the Python standard library on purpose -- no
`pip install` step is needed in CI, which removes an entire class of
CI failures (dependency resolution, version drift, etc).

Run it directly:
    python scripts/fetch_earthquake_data.py

It is normally invoked on a schedule by
.github/workflows/update-data.yml, which commits the resulting files
in data/ back to the repository. GitHub Pages then serves the updated
files automatically -- no separate deploy step is required.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Data sources (both free, keyless, official government feeds)
# ---------------------------------------------------------------------------
USGS_DAY_ALL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
USGS_WEEK_M25 = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson"
USGS_MONTH_M45 = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson"
NWS_ACTIVE_ALERTS = "https://api.weather.gov/alerts/active?status=actual&message_type=alert"

# NWS asks every consumer to identify itself with a descriptive User-Agent.
# If you fork this project, it's good practice to point this at your own
# repo/contact so NWS can reach you if they ever need to.
USER_AGENT = "EarthPulse/1.0 (https://github.com/RuHRabin/earthpulse)"

REQUEST_TIMEOUT = 20
MAX_RETRIES = 3

MAGNITUDE_BUCKETS = ["<3", "3-4", "4-5", "5-6", "6-7", "7+"]


# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------
def fetch_json(url: str) -> dict | None:
    """GET a URL and parse it as JSON, retrying on transient failures.

    Returns None (rather than raising) on final failure so a single flaky
    source never crashes the whole pipeline -- the caller decides how to
    degrade gracefully.
    """
    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            request = urllib.request.Request(
                url,
                headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
            )
            with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError,
                json.JSONDecodeError, OSError) as error:
            last_error = error
            print(f"[warn] attempt {attempt}/{MAX_RETRIES} failed for {url}: {error}",
                  file=sys.stderr)
            if attempt < MAX_RETRIES:
                time.sleep(2 * attempt)
    print(f"[error] giving up on {url}: {last_error}", file=sys.stderr)
    return None


# ---------------------------------------------------------------------------
# Country / region attribution
# ---------------------------------------------------------------------------
# USGS only gives a free-text `place` string, e.g. "148 km WSW of Tual,
# Indonesia" or "10 km N of Ridgecrest, CA". There is no country field, and
# reverse-geocoding every quake would need a paid/limited API -- so we parse
# the string. It is a best-effort heuristic, good for a "where is it
# shaking?" overview rather than for legal/administrative boundaries.
US_STATE_ABBR = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL",
    "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
    "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
    "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
}
# "Georgia" is deliberately absent: USGS uses it for the country, and the
# state is written "GA".
US_STATE_NAMES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "hawaii", "idaho", "illinois",
    "indiana", "iowa", "kansas", "kentucky", "louisiana", "maine", "maryland",
    "massachusetts", "michigan", "minnesota", "mississippi", "missouri",
    "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee",
    "texas", "utah", "vermont", "virginia", "washington", "west virginia",
    "wisconsin", "wyoming", "puerto rico",
}
# Puerto Rico is reported as its own place by USGS, so keep it separate.
US_STATE_NAMES.discard("puerto rico")

COUNTRY_ALIASES = {
    "fiji islands": "Fiji",
    "fiji region": "Fiji",
    "fiji": "Fiji",
    "kermadec islands": "Kermadec Islands (NZ)",
    "kermadec islands region": "Kermadec Islands (NZ)",
    "sumatra": "Indonesia",
    "south sandwich islands": "South Sandwich Islands",
    "south sandwich islands region": "South Sandwich Islands",
    "russia": "Russia",
}
OPEN_OCEAN_WORDS = ("ridge", "rise", "ocean", " sea", "trench", "fracture zone",
                    "plateau", "basin", "antarctic")
OPEN_OCEAN_LABEL = "Open ocean / ridges"

_DIRECTION_PREFIX = re.compile(
    r"^(?:off the |near the |off |near |offshore )?"
    r"(?:(?:east central|west central|northeast|northwest|southeast|southwest|"
    r"northern|southern|eastern|western|central|north|south|east|west)\b"
    r"(?: of the| of)? ?)+"
    r"(?:coast of |the )?",
    re.IGNORECASE,
)


def _is_us(text: str) -> bool:
    lowered = text.lower()
    if "baja" in lowered:
        return False
    return any(re.search(rf"\b{re.escape(name)}\b", lowered) for name in US_STATE_NAMES)


def country_from_place(place: str | None) -> str:
    """Best-effort country/region label from a USGS `place` string."""
    if not place:
        return "Unknown"
    place = place.strip()

    if "," in place:
        tail = place.rsplit(",", 1)[-1].strip()
        if tail.upper() in US_STATE_ABBR or tail.lower() in US_STATE_NAMES:
            return "United States"
    else:
        tail = place
        if _is_us(tail):
            return "United States"

    if tail.lower() in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[tail.lower()]

    # Strip leading compass phrases: "south of the Fiji Islands" -> "Fiji Islands".
    # Only for comma-less descriptive places: after a comma the tail is already
    # a proper name ("Western Sahara", "South Africa") that must stay intact.
    cleaned = tail
    if "," not in place:
        cleaned = _DIRECTION_PREFIX.sub("", tail).strip() or tail
        cleaned = re.sub(r"^(?:off the )?(?:west|east|north|south)\w* coast of ", "", cleaned,
                         flags=re.IGNORECASE)
        cleaned = re.sub(r"^(?:northern|southern|eastern|western) ", "", cleaned,
                         flags=re.IGNORECASE)
    lowered = cleaned.lower()

    if lowered in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[lowered]
    if any(word in f" {lowered}" for word in OPEN_OCEAN_WORDS):
        return OPEN_OCEAN_LABEL
    if lowered.endswith(" region"):
        cleaned = cleaned[: -len(" region")]
        return COUNTRY_ALIASES.get(cleaned.lower(), cleaned)
    return cleaned[:1].upper() + cleaned[1:]


def build_country_summary(quakes: list[dict], limit: int = 15) -> list[dict]:
    """Aggregate quakes by country/region: count, strongest, and share."""
    groups: dict[str, list[dict]] = defaultdict(list)
    for quake in quakes:
        groups[quake["country"]].append(quake)

    rows = []
    for country, items in groups.items():
        strongest = max(items, key=lambda q: q["mag"])
        rows.append({
            "country": country,
            "count": len(items),
            "max_magnitude": strongest["mag"],
            "strongest_place": strongest["place"],
            "strongest_url": strongest["url"],
        })
    rows.sort(key=lambda r: (-r["count"], -r["max_magnitude"], r["country"]))
    return rows[:limit]

# ---------------------------------------------------------------------------
# Earthquakes
# ---------------------------------------------------------------------------
def parse_quake_feature(feature: dict) -> dict:
    props = feature.get("properties", {}) or {}
    geometry = feature.get("geometry", {}) or {}
    coords = geometry.get("coordinates") or [None, None, None]
    lon, lat, depth_km = (list(coords) + [None, None, None])[:3]

    epoch_ms = props.get("time")
    iso_time = (
        datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).isoformat()
        if epoch_ms else None
    )

    return {
        "id": feature.get("id"),
        "mag": props.get("mag"),
        "place": props.get("place"),
        "country": country_from_place(props.get("place")),
        "time": iso_time,
        "lat": lat,
        "lon": lon,
        "depth_km": depth_km,
        "tsunami": bool(props.get("tsunami")),
        "alert": props.get("alert"),  # USGS PAGER level: green/yellow/orange/red
        "url": props.get("url"),
    }


def bucket_magnitude(mag: float | None) -> str:
    if mag is None:
        return "unknown"
    if mag < 3:
        return "<3"
    if mag < 4:
        return "3-4"
    if mag < 5:
        return "4-5"
    if mag < 6:
        return "5-6"
    if mag < 7:
        return "6-7"
    return "7+"


def build_earthquake_summary(day_geo: dict | None, week_geo: dict | None,
                              month_geo: dict | None) -> dict:
    def quakes_from(geo):
        features = (geo or {}).get("features", [])
        parsed = [parse_quake_feature(f) for f in features]
        parsed = [q for q in parsed if q["mag"] is not None]
        parsed.sort(key=lambda q: q["time"] or "", reverse=True)
        return parsed

    day_quakes = quakes_from(day_geo)
    week_quakes = quakes_from(week_geo)
    significant = quakes_from(month_geo)

    strongest_today = max(day_quakes, key=lambda q: q["mag"], default=None)
    strongest_week = max(week_quakes, key=lambda q: q["mag"], default=None)

    magnitude_distribution: dict[str, int] = defaultdict(int)
    for quake in week_quakes:
        magnitude_distribution[bucket_magnitude(quake["mag"])] += 1

    daily = defaultdict(lambda: {"count": 0, "max_mag": 0.0})
    for quake in week_quakes:
        if not quake["time"]:
            continue
        day_key = quake["time"][:10]
        daily[day_key]["count"] += 1
        daily[day_key]["max_mag"] = max(daily[day_key]["max_mag"], quake["mag"] or 0)

    daily_trend = [
        {"date": day, "count": v["count"], "max_magnitude": round(v["max_mag"], 1)}
        for day, v in sorted(daily.items())
    ]

    avg_today = (
        round(sum(q["mag"] for q in day_quakes) / len(day_quakes), 2)
        if day_quakes else None
    )

    return {
        "counts": {"today": len(day_quakes), "week": len(week_quakes)},
        "strongest_today": strongest_today,
        "strongest_week": strongest_week,
        "avg_magnitude_today": avg_today,
        "magnitude_distribution_week": {
            bucket: magnitude_distribution.get(bucket, 0) for bucket in MAGNITUDE_BUCKETS
        },
        "daily_trend_7d": daily_trend,
        # Where is it shaking? Top countries/regions over the past 7 days (M2.5+).
        "by_country_week": build_country_summary(week_quakes),
        "countries_week_total": len({q["country"] for q in week_quakes}),
        # M4.5+ in the past month is a manageable, genuinely "significant" list globally.
        "significant_recent": significant[:50],
        # Every quake in the past day, capped so the JSON stays a reasonable size.
        "today_quakes": day_quakes[:500],
        "sources_ok": {
            "day": day_geo is not None,
            "week": week_geo is not None,
            "month": month_geo is not None,
        },
    }


# ---------------------------------------------------------------------------
# US severe weather alerts (secondary panel -- NWS is US-only)
# ---------------------------------------------------------------------------
def parse_alert_feature(feature: dict) -> dict:
    props = feature.get("properties", {}) or {}
    return {
        "id": props.get("id"),
        "event": props.get("event"),
        "severity": props.get("severity") or "Unknown",
        "urgency": props.get("urgency"),
        "area": props.get("areaDesc"),
        "headline": props.get("headline"),
        "sent": props.get("sent"),
        "expires": props.get("expires"),
    }


def build_alerts_summary(alerts_geo: dict | None) -> dict:
    if alerts_geo is None:
        return {"active_count": 0, "by_severity": {}, "top_alerts": [], "unavailable": True}

    alerts = [parse_alert_feature(f) for f in alerts_geo.get("features", [])]
    by_severity: dict[str, int] = defaultdict(int)
    for alert in alerts:
        by_severity[alert["severity"]] += 1

    severity_rank = {"Extreme": 0, "Severe": 1, "Moderate": 2, "Minor": 3, "Unknown": 4}
    alerts.sort(key=lambda a: severity_rank.get(a["severity"], 5))

    return {
        "active_count": len(alerts),
        "by_severity": dict(by_severity),
        "top_alerts": alerts[:30],
        "unavailable": False,
    }


# ---------------------------------------------------------------------------
# Rolling history (one row per UTC day, so the site accumulates a real trend
# the longer it runs)
# ---------------------------------------------------------------------------
def update_history_csv(csv_path: str, today_key: str, count_today: int,
                        max_mag_today: float, avg_mag_today: float | None) -> None:
    header = ["date", "count", "max_magnitude", "avg_magnitude"]
    rows: list[list[str]] = []

    if os.path.exists(csv_path):
        with open(csv_path, newline="", encoding="utf-8") as handle:
            rows = list(csv.reader(handle))

    if not rows:
        rows = [header]

    new_row = [today_key, str(count_today), str(max_mag_today or 0),
               str(avg_mag_today if avg_mag_today is not None else 0)]

    replaced = False
    for i in range(1, len(rows)):
        if rows[i] and rows[i][0] == today_key:
            rows[i] = new_row
            replaced = True
            break
    if not replaced:
        rows.append(new_row)

    # Keep roughly the last year of daily rows so the file doesn't grow forever.
    rows = [rows[0]] + rows[1:][-365:]

    with open(csv_path, "w", newline="", encoding="utf-8") as handle:
        csv.writer(handle).writerows(rows)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
def main() -> int:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.normpath(os.path.join(script_dir, "..", "data"))
    os.makedirs(data_dir, exist_ok=True)

    print("Fetching USGS earthquake feeds...")
    day_geo = fetch_json(USGS_DAY_ALL)
    week_geo = fetch_json(USGS_WEEK_M25)
    month_geo = fetch_json(USGS_MONTH_M45)

    if day_geo is None and week_geo is None and month_geo is None:
        print("[error] all USGS feeds failed; leaving existing data/latest.json untouched.",
              file=sys.stderr)
        return 1

    summary = build_earthquake_summary(day_geo, week_geo, month_geo)

    print("Fetching NWS active severe weather alerts...")
    alerts_geo = fetch_json(NWS_ACTIVE_ALERTS)
    summary["us_weather_alerts"] = build_alerts_summary(alerts_geo)

    now = datetime.now(timezone.utc)
    summary["generated_at"] = now.isoformat()

    latest_path = os.path.join(data_dir, "latest.json")
    with open(latest_path, "w", encoding="utf-8") as handle:
        json.dump(summary, handle, ensure_ascii=False, indent=2)
    print(f"Wrote {latest_path}")

    strongest = summary.get("strongest_today")
    update_history_csv(
        os.path.join(data_dir, "history.csv"),
        today_key=now.strftime("%Y-%m-%d"),
        count_today=summary["counts"]["today"],
        max_mag_today=strongest["mag"] if strongest else 0,
        avg_mag_today=summary["avg_magnitude_today"],
    )
    print(f"Updated {os.path.join(data_dir, 'history.csv')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
