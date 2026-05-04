import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";
import { BottomNav } from "./Phase3Home";
import {
  meshBackground,
  glassSurface,
  glassSurfaceMuted,
  glassText,
} from "../components/glass/glassStyles";
import {
  queenstownPins,
  userLocation,
  defaultCenter,
  haversineKm,
  formatDistance,
  formatReviews,
  categoryLabels,
  categoryGlyph,
  chipLabels,
  chipOrder,
  plannedTrip,
  topFiveIds,
  findPin,
  type Pin,
  type PinChip,
} from "../data/queenstownPins";

/* -------------------------------------------------------------------------- */
/*  Pin / cluster icon HTML                                                    */
/* -------------------------------------------------------------------------- */

function pinIconHtml(pin: Pin, selected: boolean) {
  return `
    <div class="qpin ${selected ? "qpin-selected" : ""}">
      <div class="qpin-glow"></div>
      <div class="qpin-dot">
        <span class="qpin-glyph">${categoryGlyph[pin.category]}</span>
      </div>
    </div>
  `;
}

function userIconHtml() {
  return `
    <div class="quser">
      <div class="quser-halo"></div>
      <div class="quser-dot"></div>
    </div>
  `;
}

function clusterIconHtml(count: number) {
  return `
    <div class="qcluster">
      <div class="qcluster-glow"></div>
      <div class="qcluster-body">${count}</div>
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/*  Walking-route fetcher (OSRM public demo, /foot/ profile).                  */
/*  Falls back to a straight line if the network call fails — UI shows it     */
/*  as a dashed gold "route preview" so it's clear it's an approximation.     */
/* -------------------------------------------------------------------------- */

type LatLng = { lat: number; lng: number };
type RouteResult = { coords: [number, number][]; fallback: boolean };

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
    if (!Array.isArray(raw) || raw.length < 2) throw new Error("OSRM no route");
    // OSRM returns [lng, lat] pairs — flip for Leaflet's [lat, lng].
    const coords = raw.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    const result: RouteResult = { coords, fallback: false };
    routeCache.set(routeKey(a, b), result);
    return result;
  } catch (err) {
    // Fallback: straight line, marked so the UI can label it.
    console.warn("[Phase3Map] OSRM route failed, falling back to straight line:", err);
    const straight: [number, number][] = [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];
    const result: RouteResult = { coords: straight, fallback: true };
    routeCache.set(routeKey(a, b), result);
    return result;
  }
}

/* -------------------------------------------------------------------------- */
/*  Phase3Map                                                                  */
/* -------------------------------------------------------------------------- */

type ToolbarMode = "search" | "saved" | "trip";

export function Phase3Map() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const routeRef = useRef<L.LayerGroup | null>(null);

  const [selected, setSelected] = useState<Pin | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [chipFilter, setChipFilter] = useState<PinChip | null>(null);
  const [mode, setMode] = useState<ToolbarMode>("search");

  /* ---------- Filtered pin list (for the search sheet) ---------- */

  const visiblePins = useMemo(() => {
    let list = queenstownPins;
    if (mode === "trip") {
      const tripIds = new Set(plannedTrip.map((s) => s.pinId));
      list = list.filter((p) => tripIds.has(p.id));
    }
    if (chipFilter) list = list.filter((p) => p.chip === chipFilter);
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || categoryLabels[p.category].toLowerCase().includes(q)
      );
    }
    return list;
  }, [query, chipFilter, mode]);

  /* ---------- Map init ---------- */

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    // StrictMode guard: in React 18+ dev, effects run twice. If a prior
    // Leaflet instance left its `_leaflet_id` on the DOM, re-init throws
    // "Map container is already initialized." Reset it.
    if ((container as unknown as { _leaflet_id?: number })._leaflet_id) {
      delete (container as unknown as { _leaflet_id?: number })._leaflet_id;
      container.innerHTML = "";
    }

    const map = L.map(container, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    // Primary: Esri World Imagery (no API key). Fallback to OSM on tileerror.
    const esri = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    );
    let fellBack = false;
    esri.on("tileerror", () => {
      if (fellBack) return;
      fellBack = true;
      console.warn("[Phase3Map] Esri tile failed, falling back to OSM");
      map.removeLayer(esri);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);
    });
    esri.addTo(map);

    // Subtle dark overlay to match aesthetic
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
      }
    ).addTo(map);

    // Force a size recalculation once the iOS frame has finished laying out.
    // Without this, Leaflet sometimes renders a 0-height map and shows blank.
    setTimeout(() => map.invalidateSize(), 80);
    setTimeout(() => map.invalidateSize(), 320);

    // User pin
    L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        className: "qpin-wrapper",
        html: userIconHtml(),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      }),
      keyboard: false,
      interactive: false,
      zIndexOffset: 500,
    }).addTo(map);

    // Cluster group — small radius so individual pins are visible at default zoom
    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 28,
      iconCreateFunction: (c) =>
        L.divIcon({
          className: "qpin-wrapper",
          html: clusterIconHtml(c.getChildCount()),
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
    });
    clusterRef.current = cluster;
    map.addLayer(cluster);

    // Pin markers (we keep references so we can swap their icons)
    queenstownPins.forEach((pin) => {
      const m = L.marker([pin.lat, pin.lng], {
        icon: L.divIcon({
          className: "qpin-wrapper",
          html: pinIconHtml(pin, false),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        title: pin.name,
        riseOnHover: true,
      });
      m.on("click", () => selectPin(pin, true));
      markersRef.current[pin.id] = m;
      cluster.addLayer(m);
    });

    // Tap on the map (not a pin) closes the card
    map.on("click", () => {
      setSelected(null);
      setShowRoute(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---------- Deep-link via ?pin=<id> — auto-select on arrival -------------- */

  useEffect(() => {
    const pinId = searchParams.get("pin");
    if (!pinId || !mapRef.current) return;
    const pin = findPin(pinId);
    if (!pin) return;
    // Wait one tick so the map's initial layout is settled, then select.
    const id = setTimeout(() => {
      setSelected(pin);
      mapRef.current?.flyTo([pin.lat, pin.lng], 17, { duration: 1.4 });
    }, 250);
    return () => clearTimeout(id);
  }, [searchParams]);

  /* ---------- Apply mode/chip/query filter to which markers are visible ---------- */

  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    visiblePins.forEach((p) => {
      const m = markersRef.current[p.id];
      if (m) cluster.addLayer(m);
    });
  }, [visiblePins]);

  /* ---------- Selected pin: swap icon to highlighted, draw/remove route ---------- */

  useEffect(() => {
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const pin = findPin(id);
      if (!pin) return;
      const isSelected = selected?.id === id;
      marker.setIcon(
        L.divIcon({
          className: "qpin-wrapper",
          html: pinIconHtml(pin, isSelected),
          iconSize: isSelected ? [32, 32] : [22, 22],
          iconAnchor: isSelected ? [16, 16] : [11, 11],
        })
      );
    });
  }, [selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Always tear down the previous route layer first.
    if (routeRef.current) {
      map.removeLayer(routeRef.current);
      routeRef.current = null;
    }

    if (!showRoute || !selected) {
      setRouteStatus("idle");
      return;
    }

    const from = userLocation;
    const to = { lat: selected.lat, lng: selected.lng };
    const cached = routeCache.get(routeKey(from, to));
    let cancelled = false;

    function draw(result: RouteResult) {
      if (cancelled || !map) return;
      const layer = L.layerGroup();

      // Shadow underlay for legibility on satellite tiles
      L.polyline(result.coords, {
        color: "#000",
        weight: 8,
        opacity: result.fallback ? 0.35 : 0.45,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(layer);

      // Main stroke — solid blue for road-followed, dashed gold for fallback
      L.polyline(result.coords, {
        color: result.fallback ? "#f1d896" : "#2196F3",
        weight: 4,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
        dashArray: result.fallback ? "8, 8" : undefined,
      }).addTo(layer);

      layer.addTo(map);
      routeRef.current = layer;

      const bounds = L.latLngBounds(result.coords).pad(0.4);
      map.flyToBounds(bounds, { duration: 0.9 });
      setRouteStatus(result.fallback ? "fallback" : "ready");
    }

    if (cached) {
      draw(cached);
    } else {
      setRouteStatus("loading");
      fetchWalkingRoute(from, to).then(draw);
    }

    return () => {
      cancelled = true;
    };
  }, [showRoute, selected]);

  /* ---------- Helpers ---------- */

  function selectPin(pin: Pin, fly = true) {
    setSelected(pin);
    setShowRoute(false);
    if (fly && mapRef.current) {
      mapRef.current.flyTo([pin.lat, pin.lng], Math.max(mapRef.current.getZoom(), 16), {
        duration: 1.2,
      });
    }
    setSheetOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setShowRoute(false);
  }

  function recenter() {
    mapRef.current?.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.2 });
  }

  function changeMode(m: ToolbarMode) {
    setMode(m);
    setChipFilter(null);
    setQuery("");
    if (m === "trip") {
      // Fit to trip bounds
      const tripPins = plannedTrip
        .map((s) => findPin(s.pinId))
        .filter((p): p is Pin => !!p);
      if (tripPins.length > 1 && mapRef.current) {
        const bounds = L.latLngBounds(tripPins.map((p) => [p.lat, p.lng] as [number, number])).pad(0.4);
        mapRef.current.flyToBounds(bounds, { duration: 1.2 });
      }
    } else if (m === "search") {
      setSheetOpen(true);
    }
  }

  /* ---------- Render ---------- */

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <MapStyles />

      {/* Map container — explicit height guaranteed by absolute positioning
          inside .phone-screen which has 100% height from IOSFrame.
          zIndex: 0 + isolation establishes a stacking context so Leaflet's
          internal pane z-indices (200–700) stay contained and don't beat
          our overlay chrome. */}
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

      {/* Top-left back button — always visible, always tappable */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        style={{
          position: "absolute",
          top: 56,
          left: 14,
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.2)",
          background: "rgba(3,16,12,0.65)",
          color: glassText.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 16px rgba(0,0,0,0.45)",
          zIndex: 90,
        }}
      >
        <Icon.Back color={glassText.primary} size={18} />
      </button>

      {/* Top floating search bar (offset right of the back button) */}
      <SearchBar
        query={query}
        onFocus={() => setSheetOpen(true)}
        onChange={(v) => {
          setQuery(v);
          if (!sheetOpen) setSheetOpen(true);
        }}
        onClear={() => {
          setQuery("");
        }}
      />

      {/* Route status pill (loading / preview-fallback) */}
      {(routeStatus === "loading" || routeStatus === "fallback") && (
        <div
          style={{
            position: "absolute",
            top: 108,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "7px 14px",
            borderRadius: 999,
            border: "1px solid var(--gx-border)",
            background: "rgba(3,16,12,0.7)",
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
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  border: "2px solid rgba(241,216,150,0.35)",
                  borderTopColor: glassText.gold,
                  animation: "qspin 0.85s linear infinite",
                  display: "inline-block",
                }}
              />
              Routing…
            </>
          ) : (
            <>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: glassText.gold,
                  boxShadow: "0 0 8px rgba(241,216,150,0.85)",
                }}
              />
              Route preview · approximate
            </>
          )}
          <style>{`@keyframes qspin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Recenter pill — sits above the in-map toolbar, which is above the BottomNav */}
      <button
        onClick={recenter}
        aria-label="Recenter on me"
        style={{
          position: "absolute",
          bottom: 168,
          right: 16,
          padding: "10px 14px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(3,16,12,0.65)",
          color: glassText.primary,
          fontFamily: "'Inter Tight', sans-serif",
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 20px rgba(0,0,0,0.4)",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          zIndex: 30,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: glassText.gold,
            boxShadow: "0 0 8px rgba(241,216,150,0.85)",
          }}
        />
        Recenter
      </button>

      {/* Selected pin card — sits above toolbar + BottomNav */}
      {selected && (
        <PinCard
          pin={selected}
          showRoute={showRoute}
          onClose={clearSelection}
          onPay={() => navigate("/p3/pay")}
          onAsk={() => navigate("/p3/home")}
          onDirections={() => setShowRoute((s) => !s)}
        />
      )}

      {/* Search sheet (limited height so it never covers the BottomNav) */}
      <SearchSheet
        open={sheetOpen}
        query={query}
        onQueryChange={setQuery}
        chipFilter={chipFilter}
        onChipChange={setChipFilter}
        onSelectPin={(p) => selectPin(p, true)}
        onClose={() => setSheetOpen(false)}
        onOpen={() => setSheetOpen(true)}
        visiblePins={visiblePins}
      />

      {/* In-map toolbar (Search / Saved / Plan) — sits above the BottomNav */}
      <Toolbar mode={mode} onChange={changeMode} />

      {/* App-wide bottom nav — always visible, always on top */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 28px",
          background: "rgba(3,16,12,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          zIndex: 95,
        }}
      >
        <BottomNav active="map" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Search bar (top, floating)                                                 */
/* -------------------------------------------------------------------------- */

function SearchBar({
  query,
  onFocus,
  onChange,
  onClear,
}: {
  query: string;
  onFocus: () => void;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: 64, // make room for the back button on the left
        right: 14,
        height: 38,
        zIndex: 40,
        ...glassSurface,
        borderRadius: 999,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke={glassText.secondary} strokeWidth="2" />
        <path d="M16 16 L21 21" stroke={glassText.secondary} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search Queenstown"
        style={{
          flex: 1,
          background: "transparent",
          border: 0,
          outline: 0,
          color: glassText.primary,
          fontFamily: "'Inter Tight', sans-serif",
          fontSize: 14,
        }}
      />
      {query && (
        <button
          onClick={onClear}
          aria-label="Clear"
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: "rgba(255,255,255,0.12)",
            border: 0,
            color: glassText.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Icon.Close color={glassText.primary} size={12} />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Search sheet (bottom slide-up)                                             */
/* -------------------------------------------------------------------------- */

function SearchSheet({
  open,
  query,
  onQueryChange,
  chipFilter,
  onChipChange,
  onSelectPin,
  onClose,
  onOpen,
  visiblePins,
}: {
  open: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  chipFilter: PinChip | null;
  onChipChange: (c: PinChip | null) => void;
  onSelectPin: (pin: Pin) => void;
  onClose: () => void;
  onOpen: () => void;
  visiblePins: Pin[];
}) {
  return (
    <>
      {/* Tap outside to dismiss (subtle dim while sheet is open) */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            // stop above the BottomNav so it stays interactive
            bottom: 78,
            background: "rgba(3,16,12,0.18)",
            zIndex: 50,
            cursor: "pointer",
            transition: "opacity 200ms ease",
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          // sit above the app BottomNav (78px) so it never covers it
          bottom: 78,
          height: "62%",
          zIndex: 60,
          transform: open ? "translateY(0)" : "translateY(calc(100% - 30px))",
          transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          ...meshBackground,
          color: glassText.primary,
          borderRadius: "28px 28px 0 0",
          border: "1px solid rgba(255,255,255,0.12)",
          borderBottom: 0,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Drag handle — toggles sheet open/closed in both states */}
        <button
          onClick={() => (open ? onClose() : onOpen())}
          aria-label={open ? "Close search" : "Open search"}
          style={{
            width: "100%",
            background: "transparent",
            border: 0,
            padding: "12px 0 4px",
            cursor: "pointer",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.3)",
            }}
          />
        </button>

        {!open ? (
          <div
            style={{
              padding: "0 22px 12px",
              fontSize: 11,
              color: glassText.tertiary,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.14em",
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Pull up to search
          </div>
        ) : (
          <SheetBody
            query={query}
            onQueryChange={onQueryChange}
            chipFilter={chipFilter}
            onChipChange={onChipChange}
            onSelectPin={onSelectPin}
            visiblePins={visiblePins}
          />
        )}
      </div>
    </>
  );
}

function SheetBody({
  query,
  onQueryChange,
  chipFilter,
  onChipChange,
  onSelectPin,
  visiblePins,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  chipFilter: PinChip | null;
  onChipChange: (c: PinChip | null) => void;
  onSelectPin: (pin: Pin) => void;
  visiblePins: Pin[];
}) {
  const trimmed = query.trim();
  const showSections = trimmed.length === 0 && !chipFilter;

  return (
    <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "4px 18px 24px" }}>
      {/* Search input inside sheet */}
      <div
        style={{
          ...glassSurfaceMuted,
          borderRadius: 999,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke={glassText.secondary} strokeWidth="2" />
          <path d="M16 16 L21 21" stroke={glassText.secondary} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name or category"
          style={{
            flex: 1,
            background: "transparent",
            border: 0,
            outline: 0,
            color: glassText.primary,
            fontFamily: "'Inter Tight', sans-serif",
            fontSize: 14,
          }}
        />
      </div>

      {showSections ? (
        <>
          <YourTripSection onSelectPin={onSelectPin} />
          <TopFiveSection onSelectPin={onSelectPin} />
          <CategoryChips current={chipFilter} onChange={onChipChange} />
          <AllSection
            label="All locations"
            pins={visiblePins}
            onSelectPin={onSelectPin}
            highlight={trimmed}
          />
        </>
      ) : (
        <>
          {chipFilter && (
            <div style={{ marginBottom: 12 }}>
              <CategoryChips current={chipFilter} onChange={onChipChange} />
            </div>
          )}
          <AllSection
            label={
              trimmed
                ? `Results for "${trimmed}"`
                : `${chipLabels[chipFilter as PinChip]} in Queenstown`
            }
            pins={visiblePins}
            onSelectPin={onSelectPin}
            highlight={trimmed}
          />
        </>
      )}
    </div>
  );
}

function YourTripSection({ onSelectPin }: { onSelectPin: (p: Pin) => void }) {
  const stops = plannedTrip
    .map((s) => ({ stop: s, pin: findPin(s.pinId) }))
    .filter((x): x is { stop: typeof plannedTrip[number]; pin: Pin } => !!x.pin);

  return (
    <section style={{ marginBottom: 22 }}>
      <SectionHead label="Your trip" sub={`${stops.length} stops planned`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {stops.map(({ stop, pin }) => (
          <button
            key={`${pin.id}-${stop.day}-${stop.time}`}
            onClick={() => onSelectPin(pin)}
            style={{
              ...glassSurfaceMuted,
              borderRadius: 14,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              textAlign: "left",
              color: "inherit",
              fontFamily: "inherit",
            }}
          >
            <div style={{ width: 50, flexShrink: 0 }}>
              <div
                className="mono tnum"
                style={{
                  fontSize: 11,
                  color: glassText.secondary,
                  letterSpacing: "0.04em",
                }}
              >
                {stop.time}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: glassText.tertiary,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                {stop.day}
              </div>
            </div>
            <CategoryDot pin={pin} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  color: glassText.primary,
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {pin.name}
              </div>
              <div style={{ fontSize: 11, color: glassText.tertiary }}>
                {categoryLabels[pin.category]}
              </div>
            </div>
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "#3d2f12",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                padding: "3px 8px",
                borderRadius: 999,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              On your plan
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TopFiveSection({ onSelectPin }: { onSelectPin: (p: Pin) => void }) {
  const top = topFiveIds.map((id) => findPin(id)).filter((p): p is Pin => !!p);
  return (
    <section style={{ marginBottom: 22 }}>
      <SectionHead label="Top 5 in Queenstown" sub="Highest-rated places" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {top.map((pin) => (
          <PlaceRow key={pin.id} pin={pin} onSelect={() => onSelectPin(pin)} />
        ))}
      </div>
    </section>
  );
}

function AllSection({
  label,
  pins,
  onSelectPin,
  highlight,
}: {
  label: string;
  pins: Pin[];
  onSelectPin: (p: Pin) => void;
  highlight: string;
}) {
  return (
    <section style={{ marginBottom: 12 }}>
      <SectionHead label={label} sub={`${pins.length} place${pins.length === 1 ? "" : "s"}`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pins.map((pin) => (
          <PlaceRow
            key={pin.id}
            pin={pin}
            highlight={highlight}
            onSelect={() => onSelectPin(pin)}
          />
        ))}
        {pins.length === 0 && (
          <div
            style={{
              padding: 28,
              textAlign: "center",
              color: glassText.tertiary,
              fontSize: 13,
            }}
          >
            No places match that.
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryChips({
  current,
  onChange,
}: {
  current: PinChip | null;
  onChange: (c: PinChip | null) => void;
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <SectionHead label="Explore by category" />
      <div className="no-scrollbar" style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {chipOrder.map((c) => {
          const active = current === c;
          return (
            <button
              key={c}
              onClick={() => onChange(active ? null : c)}
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                border: active ? "1px solid rgba(241,216,150,0.6)" : "1px solid rgba(255,255,255,0.18)",
                background: active ? "rgba(241,216,150,0.18)" : "rgba(255,255,255,0.06)",
                color: active ? glassText.gold : glassText.primary,
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              {chipLabels[c]}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PlaceRow({
  pin,
  onSelect,
  highlight = "",
}: {
  pin: Pin;
  onSelect: () => void;
  highlight?: string;
}) {
  const dist = formatDistance(haversineKm(userLocation, { lat: pin.lat, lng: pin.lng }));
  return (
    <button
      onClick={onSelect}
      style={{
        ...glassSurfaceMuted,
        borderRadius: 14,
        padding: "10px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        fontFamily: "inherit",
      }}
    >
      <div
        className="scenic"
        style={{
          width: 60,
          height: 60,
          borderRadius: 10,
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          padding: 6,
          color: "rgba(255,255,255,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 7,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          overflow: "hidden",
        }}
      >
        {pin.imgLabel.split(" ").slice(0, 2).join(" ")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: glassText.primary,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {highlightText(pin.name, highlight)}
        </div>
        <div style={{ fontSize: 11, color: glassText.tertiary, marginTop: 2 }}>
          {categoryLabels[pin.category]} · {dist} away
        </div>
        <div style={{ fontSize: 11, color: glassText.secondary, marginTop: 3, display: "flex", gap: 8 }}>
          <span style={{ color: glassText.gold }}>★ {pin.rating.toFixed(1)}</span>
          <span style={{ color: glassText.tertiary }}>{formatReviews(pin.reviews)} reviews</span>
        </div>
      </div>
    </button>
  );
}

function CategoryDot({ pin }: { pin: Pin }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
        border: "1px solid rgba(255,255,255,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 12px rgba(241,216,150,0.4)",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          color: "#3d2f12",
          fontWeight: 700,
        }}
      >
        {categoryGlyph[pin.category]}
      </span>
    </div>
  );
}

function SectionHead({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <h3
        className="serif"
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: glassText.primary,
          margin: 0,
        }}
      >
        {label}
      </h3>
      {sub && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: glassText.tertiary,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function highlightText(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  const before = text.slice(0, i);
  const match = text.slice(i, i + q.length);
  const after = text.slice(i + q.length);
  return (
    <>
      {before}
      <span style={{ color: glassText.gold, fontWeight: 600 }}>{match}</span>
      {after}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pin location card                                                          */
/* -------------------------------------------------------------------------- */

function PinCard({
  pin,
  showRoute,
  onClose,
  onPay,
  onAsk,
  onDirections,
}: {
  pin: Pin;
  showRoute: boolean;
  onClose: () => void;
  onPay: () => void;
  onAsk: () => void;
  onDirections: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function dismiss() {
    setMounted(false);
    setTimeout(onClose, 220);
  }

  const distance = formatDistance(haversineKm(userLocation, { lat: pin.lat, lng: pin.lng }));
  const showPay = pin.qcash !== undefined && pin.qcash > 0 && pin.category !== "scenic" && pin.category !== "stay";

  return (
    <div
      style={{
        position: "absolute",
        // sit above the in-map toolbar (96px) and BottomNav so the card is fully visible
        bottom: 158,
        left: 14,
        right: 14,
        zIndex: 70,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        opacity: mounted ? 1 : 0,
        transition: "transform 280ms cubic-bezier(0.22,1,0.36,1), opacity 240ms ease",
      }}
    >
      <div
        style={{
          ...glassSurface,
          padding: "14px 18px 16px",
          borderRadius: 22,
          position: "relative",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
            pointerEvents: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.16em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              {categoryLabels[pin.category]} · {distance} away
            </div>
            <div
              className="serif"
              style={{
                fontSize: 22,
                letterSpacing: "-0.02em",
                color: glassText.primary,
                marginTop: 4,
                lineHeight: 1.15,
              }}
            >
              {pin.name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color: glassText.secondary,
                display: "flex",
                gap: 10,
              }}
            >
              <span style={{ color: glassText.gold }}>★ {pin.rating.toFixed(1)}</span>
              <span style={{ color: glassText.tertiary }}>{formatReviews(pin.reviews)} reviews</span>
            </div>
            <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 6, lineHeight: 1.5 }}>
              {pin.description}
            </div>
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: glassText.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Icon.Close color={glassText.primary} size={14} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            onClick={onDirections}
            style={{
              flex: 1,
              padding: "11px 14px",
              borderRadius: 999,
              border: showRoute ? "1px solid rgba(241,216,150,0.6)" : "1px solid rgba(255,255,255,0.18)",
              background: showRoute ? "rgba(241,216,150,0.16)" : "rgba(255,255,255,0.06)",
              color: showRoute ? glassText.gold : glassText.primary,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <DirArrowIcon color={showRoute ? glassText.gold : glassText.primary} />
            {showRoute ? "Hide route" : "Directions"}
          </button>
          {showPay ? (
            <button
              onClick={onPay}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.5)",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 0 18px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              Pay · Q${pin.qcash}
            </button>
          ) : (
            <button
              onClick={onAsk}
              style={{
                flex: 1,
                padding: "11px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: glassText.primary,
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Ask Q
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DirArrowIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M3 11 L21 3 L13 21 L11 13 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bottom toolbar                                                             */
/* -------------------------------------------------------------------------- */

function Toolbar({
  mode,
  onChange,
}: {
  mode: ToolbarMode;
  onChange: (m: ToolbarMode) => void;
}) {
  const items: { key: ToolbarMode; label: string }[] = [
    { key: "search", label: "Search" },
    { key: "saved", label: "Saved" },
    // Renamed from "Trip" to avoid colliding with the app BottomNav's Trip item.
    { key: "trip", label: "Plan" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        // sit above the app BottomNav (78px tall) with 12px gap
        bottom: 96,
        left: 14,
        right: 14,
        zIndex: 80,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          ...glassSurface,
          borderRadius: 999,
          padding: 5,
          display: "inline-flex",
          gap: 4,
        }}
      >
        {items.map((it) => {
          const active = mode === it.key;
          return (
            <button
              key={it.key}
              onClick={() => onChange(it.key)}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                border: 0,
                background: active ? "linear-gradient(180deg, #fde7a3, #d4b87a)" : "transparent",
                color: active ? "#3d2f12" : glassText.primary,
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.55)" : "none",
              }}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline styles for divIcons + leaflet container + pulse + route             */
/* -------------------------------------------------------------------------- */

function MapStyles() {
  return (
    <style>{`
      .qpin-wrapper { background: transparent !important; border: 0 !important; }

      .qpin {
        position: relative;
        width: 22px;
        height: 22px;
      }
      .qpin-glow {
        position: absolute;
        inset: -10px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(241,216,150,0.45), transparent 70%);
        filter: blur(4px);
        pointer-events: none;
      }
      .qpin-dot {
        position: relative;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 55%, #8a6a2a 100%);
        border: 1.5px solid rgba(255,255,255,0.55);
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.6),
          inset 0 -1px 0 rgba(0,0,0,0.15),
          0 0 12px rgba(241,216,150,0.4),
          0 2px 6px rgba(0,0,0,0.45);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 160ms ease;
      }
      .qpin:hover .qpin-dot { transform: scale(1.18); }
      .qpin-glyph {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        color: #3d2f12;
        line-height: 1;
        font-weight: 700;
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

      .quser {
        position: relative;
        width: 28px;
        height: 28px;
      }
      .quser-halo {
        position: absolute;
        inset: -6px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(241,216,150,0.55), transparent 70%);
        animation: quser-pulse 1.8s ease-out infinite;
      }
      .quser-dot {
        position: absolute;
        inset: 6px;
        border-radius: 999px;
        background: radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%);
        border: 2px solid #fff;
        box-shadow: 0 0 10px rgba(241,216,150,0.85), 0 2px 6px rgba(0,0,0,0.5);
      }
      @keyframes quser-pulse {
        0%   { transform: scale(0.85); opacity: 0.9; }
        70%  { transform: scale(1.6);  opacity: 0;   }
        100% { transform: scale(1.6);  opacity: 0;   }
      }

      .qcluster {
        position: relative;
        width: 40px;
        height: 40px;
      }
      .qcluster-glow {
        position: absolute;
        inset: -8px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(241,216,150,0.35), transparent 65%);
        filter: blur(4px);
        pointer-events: none;
      }
      .qcluster-body {
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: rgba(255,255,255,0.12);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(255,255,255,0.35);
        color: #fdfbf5;
        font-family: 'Inter Tight', sans-serif;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.55),
          0 4px 14px rgba(0,0,0,0.4);
      }

      /* Animated route */
      .qroute {
        animation: qroute-flow 1.4s linear infinite;
        filter: drop-shadow(0 0 6px rgba(241,216,150,0.6));
      }
      @keyframes qroute-flow {
        from { stroke-dashoffset: 0; }
        to   { stroke-dashoffset: -26; }
      }

      .leaflet-container { background: #031410; font-family: 'Inter Tight', sans-serif; }
      .leaflet-control-attribution { display: none !important; }

      /* Suppress default markercluster icon pseudo styles when we use divIcon HTML */
      .marker-cluster div, .marker-cluster span { background: transparent !important; }
      .marker-cluster { background: transparent !important; }
    `}</style>
  );
}
