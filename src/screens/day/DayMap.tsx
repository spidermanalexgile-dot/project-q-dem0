import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { StatusBar } from "../../components/StatusBar";
import { DayNav } from "./DayNav";
import { glassSurface, glassText } from "../../components/glass/glassStyles";
import { VeniceModeChip } from "../../components/VeniceModeChip";
import {
  dayTripperSpots,
  sanMarcoArrival,
  type DayTripperSpot,
} from "../../data/dayTripper";
import { useDayTripper } from "../../context/DayTripperContext";

const DAY_CENTER = { lat: 45.4371, lng: 12.3326 };
const DAY_ZOOM = 15;

type LatLng = { lat: number; lng: number };
type RouteResult = { coords: [number, number][]; fallback: boolean; durationMin: number };

const routeCache = new Map<string, RouteResult>();

function routeKey(a: LatLng, b: LatLng): string {
  return `${a.lat.toFixed(5)},${a.lng.toFixed(5)};${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
}

async function fetchWalkingRoute(a: LatLng, b: LatLng): Promise<RouteResult> {
  const cached = routeCache.get(routeKey(a, b));
  if (cached) return cached;
  const url =
    `https://router.project-osrm.org/route/v1/foot/` +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    const raw = json?.routes?.[0]?.geometry?.coordinates;
    const dur = json?.routes?.[0]?.duration;
    if (!Array.isArray(raw) || raw.length < 2) throw new Error("OSRM no route");
    const coords = raw.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    const result: RouteResult = {
      coords,
      fallback: false,
      durationMin: Math.max(1, Math.round((dur ?? 0) / 60)),
    };
    routeCache.set(routeKey(a, b), result);
    return result;
  } catch (err) {
    console.warn("[DayMap] OSRM failed, falling back to straight line:", err);
    const straight: [number, number][] = [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];
    // approximate walking time at 5 km/h using haversine
    const dLat = (b.lat - a.lat) * (Math.PI / 180);
    const dLng = (b.lng - a.lng) * (Math.PI / 180);
    const lat1 = a.lat * (Math.PI / 180);
    const lat2 = b.lat * (Math.PI / 180);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.sqrt(x));
    const result: RouteResult = {
      coords: straight,
      fallback: true,
      durationMin: Math.max(1, Math.round((km / 5) * 60)),
    };
    routeCache.set(routeKey(a, b), result);
    return result;
  }
}

function pinHtml(selected: boolean) {
  return `
    <div class="qpin ${selected ? "qpin-selected" : ""}">
      <div class="qpin-glow"></div>
      <div class="qpin-dot"><span class="qpin-glyph">Q</span></div>
    </div>
  `;
}

function arrivalHtml() {
  return `
    <div class="quser">
      <div class="quser-halo"></div>
      <div class="quser-dot"></div>
    </div>
  `;
}

export function DayMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSelectedSpotId } = useDayTripper();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeRef = useRef<L.LayerGroup | null>(null);

  const [selected, setSelected] = useState<DayTripperSpot | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");

  const spotById = useMemo(() => {
    const m: Record<string, DayTripperSpot> = {};
    dayTripperSpots.forEach((s) => (m[s.id] = s));
    return m;
  }, []);

  /* ---------- Map init ---------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = {};
      routeRef.current = null;
    }
    if ((container as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
      container.innerHTML = "";
    }

    const map = L.map(container, {
      center: [DAY_CENTER.lat, DAY_CENTER.lng],
      zoom: DAY_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const esri = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" },
    );
    let fellBack = false;
    esri.on("tileerror", () => {
      if (fellBack) return;
      fellBack = true;
      console.warn("[DayMap] Esri tile failed, falling back to OSM");
      map.removeLayer(esri);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
    });
    esri.addTo(map);

    L.rectangle(
      [
        [-90, -180],
        [90, 180],
      ],
      {
        color: "transparent",
        weight: 0,
        fillColor: "#031410",
        fillOpacity: 0.28,
        interactive: false,
      },
    ).addTo(map);

    setTimeout(() => map.invalidateSize(), 80);
    setTimeout(() => map.invalidateSize(), 320);

    L.marker([sanMarcoArrival.lat, sanMarcoArrival.lng], {
      icon: L.divIcon({
        className: "qpin-wrapper",
        html: arrivalHtml(),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 500,
    }).addTo(map);

    dayTripperSpots.forEach((spot) => {
      const m = L.marker([spot.lat, spot.lng], {
        icon: L.divIcon({
          className: "qpin-wrapper",
          html: pinHtml(false),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        title: spot.name,
        riseOnHover: true,
      });
      m.on("click", () => selectSpot(spot, true));
      markersRef.current[spot.id] = m;
      m.addTo(map);
    });

    map.on("click", () => {
      setSelected(null);
      setRoute(null);
      setRouteStatus("idle");
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- ?spot=<id> handling ---------- */
  useEffect(() => {
    const sid = searchParams.get("spot");
    if (!sid || !mapRef.current) return;
    const s = spotById[sid];
    if (!s) return;
    const t = setTimeout(() => {
      selectSpot(s, true);
      requestRoute(s);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, spotById]);

  /* ---------- Update marker styles when selection changes ---------- */
  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const isSel = selected?.id === id;
      marker.setIcon(
        L.divIcon({
          className: "qpin-wrapper",
          html: pinHtml(isSel),
          iconSize: isSel ? [32, 32] : [22, 22],
          iconAnchor: isSel ? [16, 16] : [11, 11],
        }),
      );
    });
  }, [selected]);

  /* ---------- Draw route when one is available ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }
    if (!route) return;

    const layer = L.layerGroup();
    L.polyline(route.coords, {
      color: "#000",
      weight: 8,
      opacity: route.fallback ? 0.35 : 0.45,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(layer);
    L.polyline(route.coords, {
      color: route.fallback ? "#f1d896" : "#2196F3",
      weight: 4,
      opacity: 1,
      lineCap: "round",
      lineJoin: "round",
      dashArray: route.fallback ? "8, 8" : undefined,
    }).addTo(layer);
    layer.addTo(map);
    routeRef.current = layer;

    const bounds = L.latLngBounds(route.coords).pad(0.4);
    map.flyToBounds(bounds, { duration: 0.9 });
  }, [route]);

  function selectSpot(spot: DayTripperSpot, fly = true) {
    setSelected(spot);
    setSelectedSpotId(spot.id);
    if (fly && mapRef.current) {
      mapRef.current.flyTo([spot.lat, spot.lng], Math.max(mapRef.current.getZoom(), 16), {
        duration: 1.0,
      });
    }
  }

  function requestRoute(spot: DayTripperSpot) {
    setRouteStatus("loading");
    setRoute(null);
    fetchWalkingRoute(sanMarcoArrival, { lat: spot.lat, lng: spot.lng }).then((r) => {
      setRoute(r);
      setRouteStatus(r.fallback ? "fallback" : "ready");
    });
  }

  return (
    <div className="phone-screen" style={{ background: "#031410", color: glassText.primary }}>
      <StatusBar dark />
      <MapStyles />

      <div
        ref={containerRef}
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#031410",
          zIndex: 0,
          isolation: "isolate",
        }}
      />

      {/* Top floating title */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 14,
          right: 14,
          zIndex: 40,
          ...glassSurface,
          borderRadius: 999,
          padding: "8px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: glassText.gold,
            boxShadow: "0 0 8px rgba(241,216,150,0.85)",
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              color: glassText.gold,
              textTransform: "uppercase",
            }}
          >
            Walkable today
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: glassText.primary, lineHeight: 1 }}>
            Central Venice
          </div>
        </div>
        <VeniceModeChip target="multi-day" variant="inline" />
        <button
          onClick={() => navigate("/day/explore")}
          style={{
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: glassText.primary,
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 600,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          List
        </button>
      </div>

      {/* Route status pill */}
      {(routeStatus === "loading" || routeStatus === "fallback" || routeStatus === "ready") && (
        <div
          style={{
            position: "absolute",
            top: 110,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--gx-border)",
            background: "rgba(3,16,12,0.78)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            color: glassText.primary,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 600,
            boxShadow: "inset 0 1px 0 var(--gx-highlight), 0 6px 16px rgba(0,0,0,0.35)",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            zIndex: 35,
          }}
        >
          {routeStatus === "loading" ? (
            <>
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 999,
                  border: "2px solid rgba(241,216,150,0.35)",
                  borderTopColor: glassText.gold,
                  animation: "qspin 0.85s linear infinite",
                  display: "inline-block",
                }}
              />
              Routing…
            </>
          ) : routeStatus === "fallback" ? (
            <>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: glassText.gold }} />
              Approx · {route?.durationMin ?? "?"} min walk
            </>
          ) : (
            <>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#2196F3" }} />
              {route?.durationMin ?? "?"} min walk
            </>
          )}
          <style>{`@keyframes qspin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Pin popup card */}
      {selected && (
        <div
          style={{
            position: "absolute",
            bottom: 92,
            left: 14,
            right: 14,
            zIndex: 70,
          }}
        >
          <div
            style={{
              ...glassSurface,
              padding: "14px 16px",
              borderRadius: 22,
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              {selected.walkMinutesFromSanMarco} min walk · {selected.qcashPriceRange}
            </div>
            <div
              className="serif"
              style={{
                fontSize: 19,
                letterSpacing: "-0.01em",
                color: glassText.primary,
                marginTop: 4,
                lineHeight: 1.2,
              }}
            >
              {selected.name}
            </div>
            <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 5, lineHeight: 1.4 }}>
              {selected.blurb}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={() => requestRoute(selected)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: glassText.primary,
                  fontFamily: "'Inter Tight', sans-serif",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Directions
              </button>
              <button
                onClick={() => navigate("/day/pay")}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(241,216,150,0.5)",
                  background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                  color: "#3d2f12",
                  fontFamily: "'Inter Tight', sans-serif",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  boxShadow: "0 0 14px rgba(241,216,150,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
                }}
              >
                Pay here
              </button>
            </div>
          </div>
        </div>
      )}

      <DayNav />
    </div>
  );
}

function MapStyles() {
  return (
    <style>{`
      .qpin-wrapper { background: transparent !important; border: 0 !important; }
      .qpin { position: relative; width: 22px; height: 22px; }
      .qpin-glow {
        position: absolute; inset: -10px; border-radius: 999px;
        background: radial-gradient(circle, rgba(241,216,150,0.45), transparent 70%);
        filter: blur(4px); pointer-events: none;
      }
      .qpin-dot {
        position: relative; width: 22px; height: 22px; border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 55%, #8a6a2a 100%);
        border: 1.5px solid rgba(255,255,255,0.55);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.6),
          inset 0 -1px 0 rgba(0,0,0,0.15),
          0 0 12px rgba(241,216,150,0.4),
          0 2px 6px rgba(0,0,0,0.45);
        display: flex; align-items: center; justify-content: center;
      }
      .qpin-glyph {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px; color: #3d2f12; line-height: 1; font-weight: 700;
      }
      .qpin-selected .qpin-dot {
        width: 32px; height: 32px;
        animation: qpin-pulse 1.6s ease-out infinite;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.7),
          inset 0 -1px 0 rgba(0,0,0,0.18),
          0 0 0 6px rgba(241,216,150,0.18),
          0 0 24px rgba(241,216,150,0.85),
          0 4px 12px rgba(0,0,0,0.5);
      }
      .qpin-selected .qpin-glyph { font-size: 14px; }
      @keyframes qpin-pulse {
        0%   { box-shadow:
                 inset 0 1px 0 rgba(255,255,255,0.7),
                 inset 0 -1px 0 rgba(0,0,0,0.18),
                 0 0 0 0px rgba(241,216,150,0.5),
                 0 0 24px rgba(241,216,150,0.85),
                 0 4px 12px rgba(0,0,0,0.5); }
        70%  { box-shadow:
                 inset 0 1px 0 rgba(255,255,255,0.7),
                 inset 0 -1px 0 rgba(0,0,0,0.18),
                 0 0 0 14px rgba(241,216,150,0),
                 0 0 24px rgba(241,216,150,0.85),
                 0 4px 12px rgba(0,0,0,0.5); }
        100% { box-shadow:
                 inset 0 1px 0 rgba(255,255,255,0.7),
                 inset 0 -1px 0 rgba(0,0,0,0.18),
                 0 0 0 0px rgba(241,216,150,0),
                 0 0 24px rgba(241,216,150,0.85),
                 0 4px 12px rgba(0,0,0,0.5); }
      }
      .quser { position: relative; width: 28px; height: 28px; }
      .quser-halo {
        position: absolute; inset: -6px; border-radius: 999px;
        background: radial-gradient(circle, rgba(241,216,150,0.55), transparent 70%);
        animation: quser-pulse 1.8s ease-out infinite;
      }
      .quser-dot {
        position: absolute; inset: 6px; border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%);
        border: 2px solid #fff;
        box-shadow: 0 0 10px rgba(241,216,150,0.85), 0 2px 6px rgba(0,0,0,0.5);
      }
      @keyframes quser-pulse {
        0%   { transform: scale(0.85); opacity: 0.9; }
        70%  { transform: scale(1.6);  opacity: 0;   }
        100% { transform: scale(1.6);  opacity: 0;   }
      }
      .leaflet-container { background: #031410; font-family: 'Inter Tight', sans-serif; }
      .leaflet-control-attribution { display: none !important; }
    `}</style>
  );
}
