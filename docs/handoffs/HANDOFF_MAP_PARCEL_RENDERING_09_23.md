# Handoff: SUTRA — Parcel Map Rendering & Platform Polish

**Created:** 2026-09-23T23:53:15+05:30  
**Branch:** `feature/ui-improvements-and-fixes`  
**Session Duration:** ~8+ hours across multiple sessions

---

## Summary

We are building **SUTRA** (previously "BhoomiSync"), a land-record GIS platform for Mohali, Punjab. The stack is Next.js 16 (frontend) + FastAPI (backend) + PostGIS + pg_tileserv — all Dockerized. The primary long-running issue is that **parcel polygon tiles are served correctly by pg_tileserv but MapLibre GL does not render them visibly on the map**. The vector tiles are confirmed working (raw PBF inspection shows valid geometries and data), but `querySourceFeatures("parcels")` returns 0 features at runtime, meaning MapLibre is not picking up the downloaded tiles into its rendering pipeline.

---

## Work Completed

### Changes Made

- [x] Rebranded app from "BhoomiSync" -> SUTRA, city from "Bengaluru" -> Mohali
- [x] Upgraded from dark theme to light theme with CSS custom property design system in `globals.css`
- [x] Resolved Tailwind v4 compilation by adding `@source` directives in `globals.css`
- [x] Added `restart: unless-stopped` to `pg_tileserv` in `docker-compose.yml`
- [x] Fixed `depends_on` with `condition: service_healthy` for `pg_tileserv` to prevent DB race condition
- [x] Fixed `source-layer` in `MapView.tsx` from `parcels_tile_view` to `public.parcels_tile_view`
- [x] Confirmed via `npx @mapbox/vt2geojson` + raw `strings` inspection that PBF tiles contain valid geometries and property data
- [x] Implemented `activePinRef` green marker in `MapView.tsx` for selected parcel
- [x] Active ULPIN highlight: thicker green border on `parcels-line` layer via `setPaintProperty`
- [x] Added Water Lines and Power Grid GeoJSON overlay layers (hardcoded Mohali corridors)
- [x] Implemented polygon draw-and-select tool (dispatches `bhoomi:draw-start/clear/complete` custom events)
- [x] Tax Defaulter markers rendered as red dot `maplibregl.Marker` elements
- [x] API `GET /parcels/{ulpin}` returns `ST_Centroid` as a GeoJSON Point for pin placement fallback
- [x] `notify-defaulter` endpoint stub created in `parcels.py`
- [x] Changed map default zoom from 12 to 16 to spawn closer to the dense parcel test data cluster
- [x] Added runtime debug overlay in top-right corner of map showing active layers + parcel feature count
- [x] `LandDeedViewer` converted to inline styles to fix `html2canvas` oklch() colour failures
- [x] Parcel Intelligence page (`/parcel`) fully wired to 5 independent API endpoints with skeleton loading

### Key Decisions

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| Keep MapLibre GL (not Leaflet) | User explicit preference; better vector tile support | Leaflet, OpenLayers |
| `pg_tileserv` for MVT | Zero-code tile serving from PostGIS views | Custom PostGIS endpoint, Martin |
| Inline styles for `LandDeedViewer` | `html2canvas` cannot handle Tailwind v4 `oklch()` colours | CSS modules, polyfill |
| Separate API endpoints per parcel sub-resource | Independent skeleton loading per section | Single fat endpoint |
| Hardcoded GeoJSON for Water/Power layers | No real infrastructure data available yet | External WMS, OSM Overpass |

---

## Files Affected

### Modified

- `frontend/src/components/map/MapView.tsx` — Core map component. Added parcel source/layers, layer sync effects, draw tool, defaulter markers, active ULPIN fly-to and pin, debug overlay. PRIMARY file for the unsolved issue.
  - Lines 76-115: parcel vector source + fill/line layers (source-layer = `public.parcels_tile_view`)
  - Lines 143-168: runtime debug overlay logic (reads `querySourceFeatures`)
  - Lines 184-267: reactive sidebar layer sync (waterLines, powerGrid, zoningRestrictions)
  - Lines 270-424: polygon draw/select tool
  - Lines 427-466: tax defaulter markers
  - Lines 469-536: active ULPIN fly-to + green pin

- `frontend/src/app/globals.css` — Design system CSS variables (light theme), `@source` directives for Tailwind v4, utility classes

- `frontend/src/app/parcel/page.tsx` — Parcel Intelligence lookup page. 5 concurrent API calls, LandDeedViewer integration

- `backend/app/routers/parcels.py` — Added `ST_AsGeoJSON(ST_Centroid(geometry))` to parcel detail query, `notify-defaulter` stub, fuzzy search, spatial query

- `backend/scripts/seed_data.py` — Updated seed to generate 30 Mohali parcels clustered around lon 76.716-76.719, lat 30.703-30.706

- `docker-compose.yml` — Added `restart: unless-stopped` and healthcheck dependency to `pg_tileserv`

- `frontend/src/lib/api.ts` — Significant changes to API call functions (158 lines deleted, rewired to new backend endpoints)

---

## Technical Context

### Architecture/Design Notes

- **Vector Tile Pipeline**: `PostGIS -> pg_tileserv (port 7800) -> MapLibre GL`. Tile URL: `{TILESERV_URL}/public.parcels_tile_view/{z}/{x}/{y}.pbf`. The `source-layer` name inside the PBF is `public.parcels_tile_view` (with schema prefix).
- **Worker URL**: MapLibre worker is pinned to `https://unpkg.com/maplibre-gl@6.9.0/dist/maplibre-gl-worker.mjs` because Next.js webpack cannot bundle workers correctly.
- **Map State**: Zustand `useMapStore` in `frontend/src/lib/store.ts`. Key fields: `activeLayers`, `activeULPIN`, `setActiveULPIN`, `mapBBox`, `defaulterMarkers`.

### Configuration

- `NEXT_PUBLIC_TILESERV_URL` = `http://localhost:7800`
- `NEXT_PUBLIC_API_URL` = `http://localhost:8000`

---

## Things to Know

### Gotchas & Pitfalls

1. **`docker compose restart` crashes pg_tileserv** — Restarting all containers simultaneously causes tileserv to crash because the DB is not ready. After any full restart, wait 15s or run `docker compose start pg_tileserv` separately.

2. **MapLibre Worker URL** — If `maplibre-gl` package version changes, update the unpkg worker URL in `MapView.tsx` line 11 to match exactly.

3. **`source-layer` must include schema** — pg_tileserv names the layer `public.parcels_tile_view` (schema.name), NOT just `parcels_tile_view`.

4. **Parcel geometries are a tiny cluster** — All 30 test parcels are in ~0.003deg x 0.003deg bounding box near `[76.718, 30.705]`. At zoom < 14, they are invisible.

5. **`querySourceFeatures` needs loaded tiles** — MapLibre only returns features from tiles currently in the viewport AND fully downloaded.

6. **Tailwind v4 `@source` directives** — Without `@source "../components"` and `@source "../app"` in globals.css, Tailwind purges all class names.

### Known Issues

- **PRIMARY OPEN ISSUE**: MapLibre reports 0 features from `querySourceFeatures("parcels")` at the viewport coordinates. Tiles ARE fetched (confirmed in pg_tileserv logs and raw PBF inspection) but MapLibre does not render them.
- Debug overlay is a temporary dev tool — remove before production
- `temp.json` in project root is a stale debug artifact — safe to delete

---

## Current State

### What's Working

- pg_tileserv serving tiles at `http://localhost:7800`
- FastAPI backend — all parcel endpoints
- Parcel Intelligence page (`/parcel`) — lookup, all sections, PDF deed
- Sidebar layer toggles — Water Lines, Power Grid, Zoning Restrictions
- Draw & Select tool — polygon drawing with custom events
- Tax Defaulter markers — red dot markers
- Active ULPIN — green pin via API centroid fallback
- Design system — consistent light theme, CSS variables

### What's Not Working

- **Parcel polygons not rendering** — Core unsolved issue. Debug shows "NO FEATURES IN PARCELS SOURCE YET" even when zoomed to parcel location.

---

## Next Steps

### Immediate (Start Here)

1. **Check SRID in DB** — Connect to DB and run:
   ```sql
   SELECT ST_SRID(geometry) FROM parcels LIMIT 1;
   ```
   Must return `4326`. If `0` or `3857`, fix the seed data geometry SRID.

2. **Try `public.parcels` table directly** — Change line 78 of `MapView.tsx`:
   ```
   ${TILESERV_URL}/public.parcels/{z}/{x}/{y}.pbf
   ```
   And line 87 + 108 `source-layer` to `public.parcels`. Both are exposed by pg_tileserv per `/index.json`.

3. **Find correct tile coords** — At zoom 16, Mohali cluster should be near tile `16/47219/27546`. Check pg_tileserv logs after refresh to see what tiles the browser actually requests.

4. **Try `queryRenderedFeatures` in console** — Open browser DevTools console while map is at zoom 16 over Mohali and paste:
   ```js
   window.__map = /* get ref */
   ```
   Or add `window.__mapRef = map` inside the `map.on('load', ...)` block temporarily, then:
   ```js
   window.__mapRef.queryRenderedFeatures(undefined, { layers: ['parcels-fill'] })
   ```

5. **Verify tile contents at zoom 16** — Find the exact tile X/Y from pg_tileserv logs and test:
   ```bash
   npx @mapbox/vt2geojson http://localhost:7800/public.parcels_tile_view/16/XXXX/YYYY.pbf
   ```

### Subsequent

- Remove debug overlay from MapView.tsx lines 570-586
- Replace hardcoded GeoJSON for Water/Power layers with real/OSM data
- Implement real `notify-defaulter` with SMS/email
- Implement parcel area overlay layer feature
- Commit all uncommitted changes and open PR to `main`
- Delete `version: "3.9"` line from `docker-compose.yml` (obsolete, causes warnings)

---

## Commands to Run

```bash
# Start the app
cd "e:\BhoomiSync Parent\BhoomiSync"
docker compose up --build

# Fix tileserv if it crashes after restart
docker compose start pg_tileserv

# Verify tileserv is alive
curl http://localhost:7800/index.json

# Debug a specific tile (replace X/Y with values from tileserv logs)
npx @mapbox/vt2geojson http://localhost:7800/public.parcels_tile_view/16/47219/27546.pbf

# Connect to DB
docker exec -it bhoomisync_db psql -U bhoomi -d landstack

# Key diagnostic queries:
# SELECT ST_SRID(geometry), ST_IsValid(geometry) FROM parcels LIMIT 5;
# SELECT COUNT(*) FROM parcels WHERE geometry IS NOT NULL;
# SELECT ulpin, ST_AsText(ST_Centroid(geometry)) FROM parcels LIMIT 3;

# Re-seed if needed
docker exec bhoomisync_backend python scripts/seed_data.py
```

---

## Open Questions

- [ ] Why does `querySourceFeatures("parcels")` return 0 features when the PBF is confirmed to contain geometries?
- [ ] Are the parcel geometries in the DB in SRID 4326 (required by MapLibre) or some other SRID?
- [ ] Should we use `public.parcels` (table) instead of `public.parcels_tile_view` (view) as the tile source?
- [ ] Is the MapLibre worker version (6.9.0) mismatched with installed `maplibre-gl` package version?
- [ ] Does pg_tileserv require a geometry column named specifically `geom` or `geometry`?

---

*This handoff was generated at context window capacity. Start a new session and use this document as your initial context.*
