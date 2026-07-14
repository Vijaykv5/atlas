"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import {
  COUNTRY_COORDS,
  MEMORY_ARCS,
  type AtlasMemory,
  getGeoCountryName,
  normalizeCountry,
} from "@/lib/atlas-globe-data";

type GeoFeature = {
  type: string;
  properties: {
    name?: string;
    NAME?: string;
    ADMIN?: string;
    __rawCountry?: string | null;
    __canonicalCountry?: string | null;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
};

type GeoJSON = {
  type: string;
  features: GeoFeature[];
};

type RingDatum = {
  lat: number;
  lng: number;
};

type ArcDatum = {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
};

type BuilderGlobeProps = {
  memories: AtlasMemory[];
  selectedCountry: string | null;
  onCountryClick: (country: string) => void;
  onCountryHover: (country: string | null) => void;
  globeRef?: React.MutableRefObject<GlobeMethods | undefined>;
};

const COUNTRY_DATA_URL = "/data/custom.geo.json";
const GLOBE_TEXTURE_URL = "/textures/earth-night.jpg";
const GLOBE_BUMP_URL = "/textures/earth-topology.png";
const GLOBE_BACKGROUND_URL = "/textures/night-sky.png";
const DRAG_THRESHOLD_PX = 6;
const MAX_DEVICE_PIXEL_RATIO = 1.25;
const ATLAS_VIOLET = "#9B45FE";
const ATLAS_VIOLET_SOFT = "#C084FC";

let cachedCountries: GeoFeature[] | null = null;
let countriesPromise: Promise<GeoFeature[]> | null = null;

function collectLngLatPairs(value: unknown, pairs: Array<[number, number]>) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    pairs.push([value[0], value[1]]);
    return;
  }

  for (const item of value) {
    collectLngLatPairs(item, pairs);
  }
}

function getFeatureCenter(feature: GeoFeature | undefined): { lat: number; lng: number } | null {
  if (!feature) {
    return null;
  }

  const pairs: Array<[number, number]> = [];
  collectLngLatPairs(feature.geometry.coordinates, pairs);

  if (pairs.length === 0) {
    return null;
  }

  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  for (const [lng, lat] of pairs) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}

function preprocessCountries(data: GeoJSON): GeoFeature[] {
  return data.features
    .map((feature) => {
      const rawCountry = getGeoCountryName(feature);
      const canonicalCountry = normalizeCountry(rawCountry);

      return {
        ...feature,
        properties: {
          ...feature.properties,
          __rawCountry: rawCountry,
          __canonicalCountry: canonicalCountry,
        },
      };
    })
    .filter(
      (feature) =>
        feature.properties.__canonicalCountry &&
        feature.properties.__canonicalCountry !== "Antarctica",
    );
}

function loadCountries(): Promise<GeoFeature[]> {
  if (cachedCountries) {
    return Promise.resolve(cachedCountries);
  }

  if (!countriesPromise) {
    countriesPromise = fetch(COUNTRY_DATA_URL)
      .then((response) => response.json())
      .then((data: GeoJSON) => {
        cachedCountries = preprocessCountries(data);
        return cachedCountries;
      });
  }

  return countriesPromise;
}

function BuilderGlobeComponent({
  memories,
  selectedCountry,
  onCountryClick,
  onCountryHover,
  globeRef: externalGlobeRef,
}: BuilderGlobeProps) {
  const internalGlobeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeRef = externalGlobeRef || internalGlobeRef;

  const [countries, setCountries] = useState<GeoFeature[]>([]);
  const [hoverCountry, setHoverCountry] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [pulseCountry, setPulseCountry] = useState<string | null>(null);

  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const initialCameraApplied = useRef(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const lastReportedHoverRef = useRef<string | null>(null);

  const normalizedSelectedCountry = useMemo(
    () => normalizeCountry(selectedCountry),
    [selectedCountry],
  );

  const memoryCountByCountry = useMemo(() => {
    const map = new Map<string, number>();
    for (const memory of memories) {
      const country = normalizeCountry(memory.country);
      if (country) {
        map.set(country, (map.get(country) || 0) + 1);
      }
    }
    return map;
  }, [memories]);

  const memoryByCountry = useMemo(() => {
    const map = new Map<string, AtlasMemory>();
    for (const memory of memories) {
      const country = normalizeCountry(memory.country);
      if (country && !map.has(country)) {
        map.set(country, memory);
      }
    }
    return map;
  }, [memories]);

  const featureByCountry = useMemo(() => {
    const map = new Map<string, GeoFeature>();

    for (const feature of countries) {
      const country = feature.properties.__canonicalCountry;
      if (country && !map.has(country)) {
        map.set(country, feature);
      }
    }

    return map;
  }, [countries]);

  const ringsData = useMemo<RingDatum[]>(() => {
    if (!pulseCountry || normalizedSelectedCountry !== pulseCountry) {
      return [];
    }

    const memory = memoryByCountry.get(pulseCountry);
    const coords =
      memory?.coordinates ||
      COUNTRY_COORDS[pulseCountry] ||
      getFeatureCenter(featureByCountry.get(pulseCountry));
    return coords ? [{ lat: coords.lat, lng: coords.lng }] : [];
  }, [featureByCountry, memoryByCountry, normalizedSelectedCountry, pulseCountry]);

  const pointData = useMemo(() => memories, [memories]);

  const resolvePolygonCountry = useCallback((polygon: object | null) => {
    const feature = polygon as GeoFeature | null;
    return {
      rawCountry: feature?.properties.__rawCountry || null,
      canonicalCountry: feature?.properties.__canonicalCountry || null,
    };
  }, []);

  const getCountryCount = useCallback(
    (country: string | null) => (country ? memoryCountByCountry.get(country) || 0 : 0),
    [memoryCountByCountry],
  );

  useEffect(() => {
    let cancelled = false;

    loadCountries()
      .then((data) => {
        if (!cancelled) {
          setCountries(data);
        }
      })
      .catch((error) => console.error("Failed to load country polygons:", error));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateDimensions = () => {
      frame = 0;
      setDimensions((current) => {
        const next = { width: window.innerWidth, height: window.innerHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    const onResize = () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(updateDimensions);
    };

    updateDimensions();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!globeRef.current || countries.length === 0) {
      return;
    }

    const controls = globeRef.current.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.16;
      controls.enableZoom = true;
      controls.minDistance = 185;
      controls.maxDistance = 360;
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.dampingFactor = 0.1;
      controls.rotateSpeed = 0.62;
      controls.zoomSpeed = 0.75;
    }

    const renderer = globeRef.current.renderer();
    renderer?.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO));

    if (!initialCameraApplied.current) {
      initialCameraApplied.current = true;
      globeRef.current.pointOfView({ lat: 20, lng: 30, altitude: 2.02 }, 0);
    }
  }, [countries.length, globeRef]);

  useEffect(() => {
    if (!normalizedSelectedCountry || !globeRef.current) {
      return;
    }

    const memory = memoryByCountry.get(normalizedSelectedCountry);
    const coords =
      memory?.coordinates ||
      COUNTRY_COORDS[normalizedSelectedCountry] ||
      getFeatureCenter(featureByCountry.get(normalizedSelectedCountry));
    if (coords) {
      globeRef.current.pointOfView({ lat: coords.lat, lng: coords.lng, altitude: 1.72 }, 900);
    }
  }, [featureByCountry, globeRef, memoryByCountry, normalizedSelectedCountry]);

  useEffect(() => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = !hoverCountry && !normalizedSelectedCountry;
    }
  }, [globeRef, hoverCountry, normalizedSelectedCountry]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      mouseDownPos.current = { x: event.clientX, y: event.clientY };
      isDragging.current = false;

      const controls = globeRef.current?.controls();
      if (controls) {
        controls.autoRotate = false;
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDownPos.current) {
        return;
      }

      const dx = event.clientX - mouseDownPos.current.x;
      const dy = event.clientY - mouseDownPos.current.y;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
        isDragging.current = true;
      }
    };

    const onMouseUp = () => {
      mouseDownPos.current = null;

      const controls = globeRef.current?.controls();
      if (controls) {
        controls.autoRotate = !hoverCountry && !normalizedSelectedCountry;
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [globeRef, hoverCountry, normalizedSelectedCountry]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        globeRef.current?.pauseAnimation();
      } else {
        globeRef.current?.resumeAnimation();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [globeRef]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  const polygonCapColor = useCallback(
    (polygon: object) => {
      const { canonicalCountry } = resolvePolygonCountry(polygon);
      const count = getCountryCount(canonicalCountry);
      const isHovered = hoverCountry === canonicalCountry;
      const isSelected = normalizedSelectedCountry === canonicalCountry;

      if (isSelected) {
        return "rgba(168, 85, 247, 0.68)";
      }

      if (isHovered) {
        return count > 0 ? "rgba(147, 51, 234, 0.52)" : "rgba(88, 28, 135, 0.24)";
      }

      return count > 0 ? "rgba(88, 28, 135, 0.46)" : "rgba(34, 20, 54, 0.74)";
    },
    [getCountryCount, hoverCountry, normalizedSelectedCountry, resolvePolygonCountry],
  );

  const polygonStrokeColor = useCallback(
    (polygon: object) => {
      const { canonicalCountry } = resolvePolygonCountry(polygon);
      const count = getCountryCount(canonicalCountry);
      const isHovered = hoverCountry === canonicalCountry;
      const isSelected = normalizedSelectedCountry === canonicalCountry;

      if (isSelected) {
        return "rgba(245, 230, 255, 0.98)";
      }

      if (isHovered) {
        return count > 0 ? "rgba(216,180,254,0.9)" : "rgba(168,85,247,0.38)";
      }

      return count > 0 ? "rgba(192,132,252,0.38)" : "rgba(147,51,234,0.16)";
    },
    [getCountryCount, hoverCountry, normalizedSelectedCountry, resolvePolygonCountry],
  );

  const polygonLabel = useCallback(
    (polygon: object) => {
      const { canonicalCountry } = resolvePolygonCountry(polygon);
      if (!canonicalCountry) {
        return "";
      }

      const count = getCountryCount(canonicalCountry);
      const label = count === 1 ? "anchored memory" : "anchored memories";

      return `
        <div style="
          background: rgba(4, 7, 18, 0.96);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 11px 13px;
          border-radius: 14px;
          min-width: 190px;
          color: white;
          box-shadow: 0 16px 42px rgba(0,0,0,0.5);
        ">
          <div style="font-size: 14px; font-weight: 800;">${canonicalCountry}</div>
          <div style="color: ${ATLAS_VIOLET_SOFT}; font-size: 12px; margin-top: 3px; font-family: monospace;">${count.toLocaleString()} ${label}</div>
        </div>
      `;
    },
    [getCountryCount, resolvePolygonCountry],
  );

  const handlePolygonClick = useCallback(
    (polygon: object) => {
      if (isDragging.current) {
        return;
      }

      const { canonicalCountry } = resolvePolygonCountry(polygon);
      if (!canonicalCountry) {
        return;
      }

      setPulseCountry(canonicalCountry);
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
      pulseTimeoutRef.current = window.setTimeout(() => {
        setPulseCountry((current) => (current === canonicalCountry ? null : current));
      }, 1300);

      onCountryClick(canonicalCountry);
    },
    [onCountryClick, resolvePolygonCountry],
  );

  const handlePolygonHover = useCallback(
    (polygon: object | null) => {
      const { canonicalCountry } = resolvePolygonCountry(polygon);
      const nextCountry = canonicalCountry || null;

      setHoverCountry((current) => (current === nextCountry ? current : nextCountry));

      if (lastReportedHoverRef.current !== nextCountry) {
        lastReportedHoverRef.current = nextCountry;
        onCountryHover(nextCountry);
      }
    },
    [onCountryHover, resolvePolygonCountry],
  );

  if (dimensions.width === 0 || dimensions.height === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-0">
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        animateIn={false}
        waitForGlobeReady={false}
        rendererConfig={{
          antialias: false,
          alpha: true,
          powerPreference: "high-performance",
        }}
        globeCurvatureResolution={4}
        polygonCapCurvatureResolution={4}
        backgroundColor="rgba(0,0,0,0)"
        backgroundImageUrl={GLOBE_BACKGROUND_URL}
        globeImageUrl={GLOBE_TEXTURE_URL}
        bumpImageUrl={GLOBE_BUMP_URL}
        atmosphereColor={ATLAS_VIOLET}
        atmosphereAltitude={0.13}
        enablePointerInteraction
        lineHoverPrecision={0.2}
        polygonsData={countries}
        polygonsTransitionDuration={260}
        polygonAltitude={(polygon: object) => {
          const { canonicalCountry } = resolvePolygonCountry(polygon);
          return normalizedSelectedCountry === canonicalCountry ? 0.0064 : 0.005;
        }}
        polygonCapColor={polygonCapColor}
        polygonSideColor={() => "rgba(23, 12, 38, 0.58)"}
        polygonStrokeColor={polygonStrokeColor}
        polygonLabel={polygonLabel}
        onPolygonClick={handlePolygonClick}
        onPolygonHover={handlePolygonHover}
        showPointerCursor={(_objType: string, data: object) => {
          const { canonicalCountry } = resolvePolygonCountry(data);
          return getCountryCount(canonicalCountry) > 0;
        }}
        arcsData={MEMORY_ARCS as ArcDatum[]}
        arcColor={() => ["rgba(155,69,254,0.34)", "rgba(216,180,254,0.24)"]}
        arcDashLength={1}
        arcDashGap={0}
        arcDashAnimateTime={0}
        arcsTransitionDuration={0}
        arcCurveResolution={8}
        arcAltitudeAutoScale={0.18}
        ringsData={ringsData}
        ringColor={() => "rgba(155,69,254,0.92)"}
        ringMaxRadius={() => 1.15}
        ringPropagationSpeed={() => 1.35}
        ringRepeatPeriod={() => 760}
        ringResolution={12}
        pointsData={pointData}
        pointLat={(point: object) => (point as AtlasMemory).coordinates.lat}
        pointLng={(point: object) => (point as AtlasMemory).coordinates.lng}
        pointAltitude={0.018}
        pointRadius={0.18}
        pointColor={() => ATLAS_VIOLET}
        pointResolution={8}
        pointsMerge
        pointsTransitionDuration={0}
      />
    </div>
  );
}

export default memo(BuilderGlobeComponent);
