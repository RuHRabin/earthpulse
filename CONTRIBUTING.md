# Contributing to EarthPulse

Thanks for considering it. This project is intentionally small and dependency-light, so most contributions are approachable even without prior context.

## Ways to help

- **Pick something from the roadmap** in [README.md](README.md#roadmap--good-first-issues).
- **Report a bug** — open an issue with what you expected vs. what happened. If it's a data issue, include a link to the specific USGS or NWS event if you can.
- **Improve the data pipeline** (`scripts/fetch_earthquake_data.py`) — more hazard types, better aggregation, smarter history retention.
- **Improve the dashboard** (`js/`, `css/style.css`) — every panel is its own module, so you can usually work on one without touching the others.

## Local setup

No build step, no dependencies to install for the frontend. For the Python script, the standard library is all you need (3.10+).

```bash
git clone https://github.com/RuHRabin/earthpulse.git
cd earthpulse

# Preview the site
python3 -m http.server 8000
# open http://localhost:8000

# Run the data pipeline
python3 scripts/fetch_earthquake_data.py
```

## Before opening a PR

- Run `python -m py_compile scripts/*.py` — the same check CI runs.
- If you touched `js/`, open `index.html` in a browser and check the console for errors. There's no test suite yet (contributions welcome there too).
- Keep the Python pipeline dependency-free if at all possible — it's a deliberate design choice (see the README's "Why this architecture" section) that keeps CI simple and fast.
- If you're adding a new data source, prefer ones that are free and require no API key, so anyone can fork this repo and have it work immediately with zero configuration.

## Design

The visual language is deliberately grounded in seismology and cartography rather than generic dashboard defaults — see the comment at the top of `css/style.css` for the reasoning. If you're adding UI, try to keep color meaningful (it should encode magnitude/severity, not decorate) rather than purely aesthetic.

## Code of conduct

Be kind, assume good faith, and keep discussion focused on the work. This is a small project built for the public good — let's keep it a pleasant place to contribute.
