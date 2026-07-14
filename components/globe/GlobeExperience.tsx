"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import {
  ATLAS_MEMORIES,
  type CountryStat,
  getGeoCountryName,
  getCountryStats,
  normalizeCountry,
} from "@/lib/atlas-globe-data";

const BuilderGlobe = dynamic(() => import("./BuilderGlobe"), {
  ssr: false,
  loading: () => <GlobeLoadingState />,
});

function GlobeLoadingState() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#05070d] text-sm uppercase tracking-[0.32em] text-white/48">
      Loading globe
    </div>
  );
}

export function GlobeExperience() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [searchableCountries, setSearchableCountries] = useState<string[]>([]);

  const countryStats = useMemo(() => getCountryStats(ATLAS_MEMORIES), []);
  const selectedStat = selectedCountry
    ? countryStats.find((item) => item.country === selectedCountry) || {
        country: selectedCountry,
        count: 0,
      }
    : null;

  const clearSelection = useCallback(() => {
    setSelectedCountry(null);
    setHoveredCountry(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);

  useEffect(() => {
    let cancelled = false;

    fetch("/data/custom.geo.json")
      .then((response) => response.json())
      .then((data: { features?: Array<{ properties?: Record<string, unknown> }> }) => {
        if (cancelled) {
          return;
        }

        const countries = Array.from(
          new Set(
            (data.features || [])
              .map((feature) => normalizeCountry(getGeoCountryName(feature)))
              .filter((country): country is string => Boolean(country) && country !== "Antarctica"),
          ),
        ).sort((a, b) => a.localeCompare(b));

        setSearchableCountries(countries);
      })
      .catch((error) => {
        console.error("Failed to load searchable countries:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectCountry = useCallback((country: string) => {
    setSelectedCountry(country);
    setHoveredCountry(null);
  }, []);

  return (
    <main className="relative h-svh min-h-[640px] overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(155,69,254,0.16),transparent_30rem),linear-gradient(180deg,rgba(5,7,13,0.1),rgba(5,7,13,0.84))]" />

      <BuilderGlobe
        globeRef={globeRef}
        memories={ATLAS_MEMORIES}
        selectedCountry={selectedCountry}
        onCountryClick={setSelectedCountry}
        onCountryHover={setHoveredCountry}
      />

      <TopBar />
      <CountrySearch
        key={selectedCountry || "country-search"}
        countries={searchableCountries}
        selectedCountry={selectedCountry}
        onSelect={handleSelectCountry}
      />
      <CountryRail
        countryStats={countryStats}
        selectedCountry={selectedCountry}
        onSelect={handleSelectCountry}
      />
      <StatusPill
        selectedCountry={selectedCountry}
        hoveredCountry={hoveredCountry}
        memoryCount={ATLAS_MEMORIES.length}
      />

      {selectedStat ? (
        <SelectedCountryPanel stat={selectedStat} onClose={clearSelection} />
      ) : null}
    </main>
  );
}

function TopBar() {
  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-4 p-4 sm:p-6">
      <Link
        href="/"
        className="pointer-events-auto inline-flex min-h-11 items-center gap-3 rounded-full border border-white/12 bg-black/40 px-4 text-sm font-semibold text-white shadow-2xl shadow-black/30 backdrop-blur-md transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <span className="grid size-8 place-items-center rounded-full bg-[#9B45FE]/15 text-[#C084FC]">
          A
        </span>
        atlas globe
      </Link>

      <div className="hidden rounded-full border border-white/12 bg-black/40 px-4 py-3 text-xs uppercase tracking-[0.24em] text-white/56 backdrop-blur-md sm:block">
        drag to explore
      </div>
    </header>
  );
}

function CountrySearch({
  countries,
  selectedCountry,
  onSelect,
}: {
  countries: string[];
  selectedCountry: string | null;
  onSelect: (country: string) => void;
}) {
  const [query, setQuery] = useState(selectedCountry || "");

  const resolveCountry = useCallback(
    (value: string) => {
      const normalizedQuery = value.trim().toLowerCase();
      if (!normalizedQuery) {
        return null;
      }

      return (
        countries.find((country) => country.toLowerCase() === normalizedQuery) ||
        countries.find((country) => country.toLowerCase().includes(normalizedQuery)) ||
        null
      );
    },
    [countries],
  );

  const hasResolvableQuery = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return false;
    }

    return countries.some(
      (country) =>
        country.toLowerCase() === normalizedQuery ||
        country.toLowerCase().includes(normalizedQuery),
    );
  }, [countries, query]);

  const submitCountry = useCallback(
    (country: string) => {
      const resolvedCountry = resolveCountry(country);
      if (!resolvedCountry) {
        return;
      }

      onSelect(resolvedCountry);
      setQuery(resolvedCountry);
    },
    [onSelect, resolveCountry],
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submitCountry(query);
      }}
      className="pointer-events-auto absolute left-1/2 top-20 z-30 w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2 sm:top-6"
      role="search"
    >
      <label className="sr-only" htmlFor="country-search">
        Search countries
      </label>
      <div className="relative rounded-full border border-white/12 bg-black/52 p-1 shadow-2xl shadow-black/35 backdrop-blur-md">
        <input
          id="country-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search any country"
          autoComplete="off"
          className="h-12 w-full rounded-full border border-white/8 bg-white/[0.045] pl-5 pr-28 text-sm font-semibold text-white placeholder:text-white/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        />
        <button
          type="submit"
          disabled={!hasResolvableQuery}
          className="absolute right-2 top-2 inline-flex h-10 items-center justify-center rounded-full bg-[#9B45FE] px-4 text-xs font-extrabold text-white transition-transform duration-150 hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          Search
        </button>
      </div>
    </form>
  );
}

function CountryRail({
  countryStats,
  selectedCountry,
  onSelect,
}: {
  countryStats: CountryStat[];
  selectedCountry: string | null;
  onSelect: (country: string) => void;
}) {
  return (
    <aside className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 sm:bottom-auto sm:right-auto sm:top-24 sm:w-72">
      <div className="pointer-events-auto rounded-3xl border border-white/10 bg-black/42 p-3 shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between gap-3 px-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#C084FC]">
            memory hubs
          </p>
          <span className="text-xs text-white/48">{countryStats.length}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 sm:block sm:max-h-[46vh] sm:space-y-2 sm:overflow-y-auto sm:pb-0">
          {countryStats.map((stat) => (
            <button
              key={stat.country}
              onClick={() => onSelect(stat.country)}
              className={`flex min-h-12 min-w-44 items-center justify-between gap-4 rounded-2xl border px-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:w-full ${
                selectedCountry === stat.country
                  ? "border-[#9B45FE]/60 bg-[#9B45FE]/16 text-white"
                  : "border-white/8 bg-white/[0.035] text-white/72 hover:bg-white/[0.07]"
              }`}
            >
              <span className="truncate text-sm font-semibold">{stat.country}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/64">
                {stat.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function StatusPill({
  selectedCountry,
  hoveredCountry,
  memoryCount,
}: {
  selectedCountry: string | null;
  hoveredCountry: string | null;
  memoryCount: number;
}) {
  const label = selectedCountry || hoveredCountry || "Auto-rotating";

  return (
    <div className="pointer-events-none absolute bottom-28 right-4 z-20 rounded-full border border-white/10 bg-black/48 px-4 py-3 text-xs text-white/64 shadow-2xl shadow-black/30 backdrop-blur-md sm:bottom-6">
      <span className="mr-2 inline-block size-2 rounded-full bg-[#9B45FE] shadow-[0_0_16px_rgba(155,69,254,0.85)]" />
      {label} · {memoryCount} memories
    </div>
  );
}

function SelectedCountryPanel({
  stat,
  onClose,
}: {
  stat: CountryStat;
  onClose: () => void;
}) {
  return (
    <section className="absolute right-4 top-24 z-30 hidden w-80 rounded-3xl border border-white/10 bg-black/58 p-5 shadow-2xl shadow-black/40 backdrop-blur-md md:block">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#C084FC]">
            selected place
          </p>
          <h2 className="mt-2 text-3xl font-semibold leading-none text-white">
            {stat.country}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="grid min-h-10 min-w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="Clear selected country"
        >
          ×
        </button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <strong className="block text-4xl leading-none text-white">{stat.count}</strong>
        <span className="mt-2 block text-sm leading-6 text-white/58">
          {stat.count > 0
            ? `anchored Atlas ${stat.count === 1 ? "memory" : "memories"} discovered in this country.`
            : "No anchored Atlas memories here yet. Search still takes you to the country."}
        </span>
      </div>
    </section>
  );
}
