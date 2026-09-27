"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapStore } from "@/lib/store";
import PropertyDetailsModal from "./PropertyDetailsModal";

if (typeof window !== 'undefined') {
  maplibregl.setWorkerCount(1);
  maplibregl.setWorkerUrl('https://unpkg.com/maplibre-gl@6.9.0/dist/maplibre-gl-worker.mjs');
}

const MOHALI_CENTER: [number, number] = [76.7179, 30.7046];
const TILESERV_URL = process.env.NEXT_PUBLIC_TILESERV_URL || "http://localhost:7800";

const LAND_USE_COLORS: Record<string, string> = {
  Residential: "#3B82F6",
  Commercial: "#F59E0B",
  Industrial: "#EF4444",
  Agricultural: "#10B981",
  Mixed: "#8B5CF6",
};

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "osm": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19
    }
  },
  layers: [
    {
      id: "basemap",
      type: "raster",
      source: "osm",
      paint: { 
        "raster-opacity": 0.8,
        "raster-saturation": -0.8
      }
    }
  ]
};

export default function MapView() {
  const { activeLayers, activeULPIN, setActiveULPIN, setMapBBox, defaulterMarkers, addDefaulterMarker, clearDefaulterMarkers } = useMapStore();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [debugLog, setDebugLog] = useState<string>("Initializing map...");
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const activePinRef = useRef<maplibregl.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: MOHALI_CENTER,
      zoom: 16,
    });

    mapRef.current = map;

    map.on('load', () => {
      setDebugLog("Map style loaded, adding layers...");


      // ── Parcel tiles from pg_tileserv
      map.addSource('parcels', {
        type: "vector",
        tiles: [`${TILESERV_URL}/public.parcels_tile_view/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 22
      });

      map.addLayer({
        id: "parcels-fill",
        type: "fill",

        "source-layer": "public.parcels_tile_view",

        source: "parcels",
        paint: {
          "fill-color": [
            "match", ["get", "land_use"],
            "Residential", LAND_USE_COLORS.Residential,
            "Commercial", LAND_USE_COLORS.Commercial,
            "Industrial", LAND_USE_COLORS.Industrial,
            "Agricultural", LAND_USE_COLORS.Agricultural,
            "Mixed", LAND_USE_COLORS.Mixed,
            "#4A5568",
          ],
          "fill-opacity": 0.60,
        }
      });

      map.addLayer({
        id: "parcels-line",
        type: "line",

        "source-layer": "public.parcels_tile_view",

        source: "parcels",
        paint: {
          "line-color": "#333",
          "line-width": 1,
        }
      });

      // Map Events
      map.on('click', 'parcels-fill', (e) => {
        const feature = e.features?.[0];
        if (feature && feature.properties.ulpin) {
          setActiveULPIN(feature.properties.ulpin);
        }
      });

      map.on('mousemove', 'parcels-fill', (e) => {
        const feature = e.features?.[0];
        if (feature) {
          map.getCanvas().style.cursor = 'pointer';
          setHoverInfo({ feature, x: e.point.x, y: e.point.y });
        }
      });

      map.on('mouseleave', 'parcels-fill', () => {
        map.getCanvas().style.cursor = '';
        setHoverInfo(null);
      });

      map.on('moveend', () => {
        const b = map.getBounds();
        setMapBBox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      });

      const updateDebug = () => {
        try {
          const style = map.getStyle();
          let msg = "";
          if (style && style.layers) {
            msg = "Active Layers: " + style.layers.map((l: any) => l.id).join(", ");
          }
          
          // Debug actual source features to find the mysterious layer name!
          const features = map.querySourceFeatures("parcels");
          if (features.length > 0) {
            const layerNames = Array.from(new Set(features.map((f: any) => f.layer?.id || f.sourceLayer)));
            msg += " | FOUND VECTOR LAYERS: " + layerNames.join(", ");
          } else {
            msg += " | NO FEATURES IN PARCELS SOURCE YET";
          }
          
          setDebugLog(msg);
        } catch (err: any) {
          setDebugLog("Error: " + err.message);
        }
      };

      map.on('idle', updateDebug);
      map.on('sourcedata', updateDebug);
      updateDebug();
    });

  }, []);

  // Update dynamic parcel styling when activeULPIN changes
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getLayer('parcels-line')) return;
    mapRef.current.setPaintProperty('parcels-line', 'line-color', [
      "case", ["==", ["get", "ulpin"], activeULPIN || ""], "#00C896", "#333"
    ]);
    mapRef.current.setPaintProperty('parcels-line', 'line-width', [
      "case", ["==", ["get", "ulpin"], activeULPIN || ""], 4, 1
    ]);
  }, [activeULPIN]);

  // Sync reactive layers from the sidebar toggles
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const [cx, cy] = [76.7179, 30.7046];

    const syncLayer = (sourceId: string, active: boolean, sourceDef: any, layerDefs: any[]) => {
      if (active) {
        if (!map.getSource(sourceId)) map.addSource(sourceId, sourceDef);
        for (const layer of layerDefs) {
          if (!map.getLayer(layer.id)) map.addLayer({ ...layer, source: sourceId });
        }
      } else {
        for (const layer of layerDefs) {
          if (map.getLayer(layer.id)) map.removeLayer(layer.id);
        }
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    };

    const runSync = () => {
      // ── Water Lines — approximate Mohali water main corridors
      syncLayer('water-lines', !!activeLayers.waterLines, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            // Airport Road (E-W)
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.74, 30.68], [76.7179, 30.7046], [76.68, 30.73]] }, properties: {} },
            // Phase 7 to 3B2 (N-S)
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.72, 30.71], [76.7179, 30.7046], [76.71, 30.70]] }, properties: {} },
            // Sector 74 to Industrial Area
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.69, 30.72], [76.71, 30.70], [76.73, 30.69]] }, properties: {} }
          ]
        }
      }, [{ id: 'water-lines-layer', type: 'line', paint: { "line-color": "#3B82F6", "line-width": 2.5, "line-opacity": 0.8 } }]);

      // ── Power Grid — approximate Mohali transmission corridors
      syncLayer('power-grid', !!activeLayers.powerGrid, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            // Sector 62 to Sector 71
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.74, 30.69], [76.7179, 30.7046], [76.70, 30.70]] }, properties: {} },
            // Sector 82 Industrial to Sector 66
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.75, 30.65], [76.73, 30.67], [76.71, 30.69]] }, properties: {} },
            // Kharar to Sector 74
            { type: "Feature", geometry: { type: "LineString", coordinates: [[76.65, 30.74], [76.67, 30.73], [76.69, 30.72]] }, properties: {} }
          ]
        }
      }, [{ id: 'power-grid-layer', type: 'line', paint: { "line-color": "#F59E0B", "line-width": 2, "line-opacity": 0.85 } }]);

      // ── Tax Defaulters Heatmap (kept for legacy, but now using markers)
      syncLayer('tax-heat', false, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: []
        }
      }, []);

      // ── Zoning Restrictions
      syncLayer('zoning', !!activeLayers.zoningRestrictions, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            { type: "Feature", geometry: { type: "Polygon", coordinates: [[[cx - 0.003, cy - 0.002], [cx + 0.001, cy - 0.002], [cx + 0.001, cy + 0.002], [cx - 0.003, cy + 0.002], [cx - 0.003, cy - 0.002]]] }, properties: { zone: "Commercial" } },
            { type: "Feature", geometry: { type: "Polygon", coordinates: [[[cx + 0.0015, cy - 0.0025], [cx + 0.005, cy - 0.0025], [cx + 0.005, cy + 0.001], [cx + 0.0015, cy + 0.001], [cx + 0.0015, cy - 0.0025]]] }, properties: { zone: "Industrial" } },
          ]
        }
      }, [
        { id: 'zoning-fill', type: 'fill', paint: { "fill-color": ["match", ["get", "zone"], "Commercial", "#F59E0B", "Industrial", "#EF4444", "#8B5CF6"], "fill-opacity": 0.5 } },
        { id: 'zoning-outline', type: 'line', paint: { "line-color": ["match", ["get", "zone"], "Commercial", "#F59E0B", "Industrial", "#EF4444", "#8B5CF6"], "line-width": 3, "line-opacity": 0.8 } }
      ]);
    };

    if (map.isStyleLoaded()) {
      runSync();
    } else {
      map.once('idle', runSync);
    }
  }, [activeLayers]);

  // ── Polygon drawing ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let drawMode = false;
    let coords: [number, number][] = [];
    let resourceIds: string[] = [];

    const cleanup = () => {
      // Layers must be removed before their sources
      for (const id of resourceIds) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of resourceIds) {
        if (map.getSource(id)) map.removeSource(id);
      }
      resourceIds = [];
      coords = [];
    };

    const renderPreview = (pts: [number, number][]) => {
      cleanup();
      if (pts.length === 0) return;

      map.addSource("draw-pts-src", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: pts.map((c, i) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: c },
            properties: { i },
          })),
        },
      });
      map.addLayer({
        id: "draw-pts-layer",
        type: "circle",
        source: "draw-pts-src",
        paint: {
          "circle-radius": 5,
          "circle-color": "#00C896",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 2,
        },
      });
      // Track layers first, sources second (cleanup removes layers then sources)
      resourceIds.push("draw-pts-layer", "draw-pts-src");

      if (pts.length >= 2) {
        map.addSource("draw-line-src", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "LineString", coordinates: pts },
            properties: {},
          },
        });
        map.addLayer({
          id: "draw-line-layer",
          type: "line",
          source: "draw-line-src",
          paint: {
            "line-color": "#00C896",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
        resourceIds.push("draw-line-layer", "draw-line-src");
      }
    };

    const finishPolygon = () => {
      drawMode = false;
      map.getCanvas().style.cursor = "";
      map.dragPan.enable();

      if (coords.length < 3) {
        cleanup();
        return;
      }

      const closed = [...coords, coords[0]];
      const polygon = {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [closed] },
        properties: {},
      };

      cleanup();

      map.addSource("draw-final-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [polygon] },
      });
      map.addLayer({
        id: "draw-final-fill",
        type: "fill",
        source: "draw-final-src",
        paint: { "fill-color": "#00C896", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "draw-final-line",
        type: "line",
        source: "draw-final-src",
        paint: { "line-color": "#00C896", "line-width": 3 },
      });
      // Layers listed first so cleanup removes them before sources
      resourceIds = ["draw-final-fill", "draw-final-line", "draw-final-src"];

      window.dispatchEvent(
        new CustomEvent("bhoomi:draw-complete", { detail: { polygon } })
      );
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawMode) return;
      coords.push([e.lngLat.lng, e.lngLat.lat]);
      renderPreview(coords);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      if (!drawMode) return;
      e.preventDefault();
      finishPolygon();
    };

    const onDrawStart = () => {
      drawMode = true;
      coords = [];
      cleanup();
      map.getCanvas().style.cursor = "crosshair";
      map.dragPan.disable();
    };

    const onDrawClear = () => {
      drawMode = false;
      cleanup();
      map.getCanvas().style.cursor = "";
      map.dragPan.enable();
    };

    map.on("click", onClick);
    map.on("dblclick", onDblClick);
    window.addEventListener("bhoomi:draw-start", onDrawStart);
    window.addEventListener("bhoomi:draw-clear", onDrawClear);

    return () => {
      map.off("click", onClick);
      map.off("dblclick", onDblClick);
      window.removeEventListener("bhoomi:draw-start", onDrawStart);
      window.removeEventListener("bhoomi:draw-clear", onDrawClear);
      cleanup();
    };
  }, []);

  // Render defaulter markers when taxDefaulters layer is toggled
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear existing markers
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    if (!activeLayers.taxDefaulters || defaulterMarkers.length === 0) {
      return;
    }

    // Add markers for each defaulter
    defaulterMarkers.forEach((markerData) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background: #EF4444;
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      el.title = `ULPIN: ${markerData.ulpin}\nOwner: ${markerData.owner_name || 'N/A'}\nDue: ₹${markerData.amount_due?.toFixed(2) || 'N/A'}`;
      
      el.addEventListener('click', () => {
        setActiveULPIN(markerData.ulpin);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(markerData.coordinates)
        .addTo(map);
      
      markerRefs.current.push(marker);
    });
  }, [activeLayers.taxDefaulters, defaulterMarkers]);

  // Handle active ULPIN flying
  useEffect(() => {
    if (activeULPIN && mapRef.current) {
      const map = mapRef.current;
      const features = map.querySourceFeatures("parcels", {
        sourceLayer: "public.parcels_tile_view",
        filter: ["==", "ulpin", activeULPIN]
      });

      if (features.length > 0) {
        // Compute centroid from the polygon vertices in the tile
        const geom = features[0].geometry as any;
        let coords: [number, number] | null = null;
        if (geom.type === "Polygon") {
          const ring = geom.coordinates[0] as [number, number][];
          const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
          const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
          coords = [lng, lat];
        } else if (geom.type === "MultiPolygon") {
          const ring = geom.coordinates[0][0] as [number, number][];
          const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
          const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
          coords = [lng, lat];
        }
        if (coords) {
          if (activePinRef.current) activePinRef.current.remove();
          activePinRef.current = new maplibregl.Marker({ color: "#00C896" })
            .setLngLat(coords)
            .addTo(map);
          map.flyTo({ center: coords, zoom: 19, essential: true });
        }
      } else {
        // Feature not in current viewport tiles — check defaulterMarkers then API
        const marker = defaulterMarkers.find(m => m.ulpin === activeULPIN);
        if (marker) {
          if (activePinRef.current) activePinRef.current.remove();
          activePinRef.current = new maplibregl.Marker({ color: "#00C896" })
            .setLngLat(marker.coordinates)
            .addTo(map);
          map.flyTo({ center: marker.coordinates, zoom: 19, essential: true });
        } else {
          // API now returns ST_Centroid as a GeoJSON Point
          fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/parcels/${activeULPIN}`)
            .then(res => res.ok ? res.json() : null)
            .then(parcel => {
              if (parcel && parcel.geometry && parcel.geometry.type === "Point") {
                const [lng, lat] = parcel.geometry.coordinates as [number, number];
                if (activePinRef.current) activePinRef.current.remove();
                activePinRef.current = new maplibregl.Marker({ color: "#00C896" })
                  .setLngLat([lng, lat])
                  .addTo(map);
                map.flyTo({ center: [lng, lat], zoom: 19, essential: true });
                return;
              }
              map.flyTo({ center: MOHALI_CENTER, zoom: 14, essential: true });
            })
            .catch(() => {
              map.flyTo({ center: MOHALI_CENTER, zoom: 14, essential: true });
            });
        }
      }
    } else {
      // Clear the active pin if no parcel is selected
      if (activePinRef.current) {
        activePinRef.current.remove();
        activePinRef.current = null;
      }
    }
  }, [activeULPIN]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Tooltip */}
      {hoverInfo && hoverInfo.feature && hoverInfo.feature.properties.ulpin && (
        <div style={{
          position: "absolute",
          left: hoverInfo.x + 10,
          top: hoverInfo.y + 10,
          backgroundColor: "white",
          padding: "4px 8px",
          borderRadius: "4px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          pointerEvents: "none",
          fontSize: "12px",
          fontWeight: "bold",
          zIndex: 100
        }}>
          ULPIN: {hoverInfo.feature.properties.ulpin}
        </div>
      )}

      {/* Render Property Details Modal when activeULPIN is set */}
      {activeULPIN && (
        <PropertyDetailsModal 
          ulpin={activeULPIN} 
          onClose={() => setActiveULPIN(null)} 
        />
      )}

      {/* Debug internal MapLibre state */}
      <div style={{
        position: "absolute",
        top: 10,
        right: 10,
        background: "rgba(0,0,0,0.8)",
        color: "#10B981",
        padding: "10px",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        maxWidth: "400px",
        wordWrap: "break-word",
        zIndex: 9999,
        pointerEvents: "none"
      }}>
        {debugLog}
      </div>
    </div>
  );
}
