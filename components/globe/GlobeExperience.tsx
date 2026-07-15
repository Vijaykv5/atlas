"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { ConnectWalletButton } from "@/components/landing/ConnectWalletButton";
import {
  ATLAS_MEMORIES,
  type CountryStat,
  getGeoCountryName,
  getCountryStats,
  normalizeCountry,
} from "@/lib/atlas-globe-data";
import { isWalletConnected, type EthereumProvider } from "@/utils/wallet";

type AtlasMode = "explore" | "create";

const AVALANCHE_FUJI = {
  chainId: "0xa869",
  chainName: "Avalanche Fuji C-Chain",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io"],
};

const ATLAS_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS;

const BuilderGlobe = dynamic(() => import("./BuilderGlobe"), {
  ssr: false,
  loading: () => <GlobeLoadingState />,
});

const COUNTRY_DRAWER_TIMING = {
  cardInitialDelayMs: 120,
  cardStaggerMs: 45,
};

function GlobeLoadingState() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[#05070d] text-sm uppercase tracking-[0.32em] text-white/48">
      Loading globe
    </div>
  );
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <section
      aria-label="Loading"
      aria-busy="true"
      className={`loadscreen fixed inset-0 z-[1200] flex min-h-screen items-center justify-center overflow-hidden px-6 motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out ${
        progress >= 100 ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative z-10 w-full max-w-xl text-center">
        <p className="loadscreen-title text-sm font-bold uppercase text-white sm:text-base">
          Loading Atlas
        </p>

        <div
          className="loadscreen-bar mt-4 h-6 overflow-hidden rounded-md border border-violet-300/70 bg-slate-950/70 p-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="loadscreen-bar-fill h-full rounded-sm"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="loadscreen-percent mt-4 font-mono text-lg font-bold text-violet-100">
          {progress}%
        </p>
      </div>
    </section>
  );
}

export function GlobeExperience() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [showLoadscreen, setShowLoadscreen] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [mode, setMode] = useState<AtlasMode>(() => {
    if (typeof window === "undefined") {
      return "explore";
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "create" ? "create" : "explore";
  });
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
  const selectedMemories = useMemo(
    () =>
      selectedCountry
        ? ATLAS_MEMORIES.filter((memory) => normalizeCountry(memory.country) === selectedCountry)
        : [],
    [selectedCountry],
  );

  const clearSelection = useCallback(() => {
    setSelectedCountry(null);
    setHoveredCountry(null);
  }, []);

  const changeMode = useCallback((nextMode: AtlasMode) => {
    setMode(nextMode);
    setSelectedCountry(null);
    setHoveredCountry(null);

    const url = nextMode === "create" ? "/atlas?mode=create" : "/atlas";
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setLoadProgress((value) => {
        if (value >= 100) return 100;
        return Math.min(value + 5, 100);
      });
    }, 90);

    return () => {
      window.clearInterval(progressTimer);
    };
  }, []);

  useEffect(() => {
    if (loadProgress < 100) return;

    const timer = window.setTimeout(() => {
      setShowLoadscreen(false);
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadProgress]);

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

  if (showLoadscreen) {
    return (
      <main className="relative h-svh min-h-[640px] overflow-hidden bg-[#05070d] text-white">
        <LoadingScreen progress={loadProgress} />
      </main>
    );
  }

  return (
    <main className="relative h-svh min-h-[640px] overflow-hidden bg-[#05070d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(155,69,254,0.16),transparent_30rem),linear-gradient(180deg,rgba(5,7,13,0.1),rgba(5,7,13,0.84))]" />

      {mode === "explore" ? (
        <BuilderGlobe
          globeRef={globeRef}
          memories={ATLAS_MEMORIES}
          selectedCountry={selectedCountry}
          onCountryClick={setSelectedCountry}
          onCountryHover={setHoveredCountry}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(244,181,65,0.11),transparent_18rem),radial-gradient(circle_at_50%_60%,rgba(155,69,254,0.22),transparent_28rem)]" />
      )}

      <TopBar />
      <AtlasModeSwitcher mode={mode} onChange={changeMode} />

      {mode === "explore" ? (
        <CountrySearch
          key={selectedCountry || "country-search"}
          countries={searchableCountries}
          selectedCountry={selectedCountry}
          onSelect={handleSelectCountry}
        />
      ) : null}

      {mode === "create" ? (
        <CreateMemoryPanel
          countries={searchableCountries}
          onExplore={() => changeMode("explore")}
        />
      ) : null}

      {mode === "explore" && !selectedCountry ? (
        <>
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
        </>
      ) : null}

      {mode === "explore" && selectedStat ? (
        <SelectedCountryPanel
          memories={selectedMemories}
          stat={selectedStat}
          onClose={clearSelection}
        />
      ) : null}
    </main>
  );
}

function AtlasModeSwitcher({
  mode,
  onChange,
}: {
  mode: AtlasMode;
  onChange: (mode: AtlasMode) => void;
}) {
  return (
    <div className="pointer-events-auto absolute left-1/2 top-24 z-30 grid w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2 grid-cols-2 rounded-full border border-white/10 bg-black/48 p-1 shadow-2xl shadow-black/35 backdrop-blur-md sm:top-6">
      <button
        type="button"
        onClick={() => onChange("explore")}
        className={`min-h-12 rounded-full px-4 text-sm font-black uppercase tracking-[0.16em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          mode === "explore"
            ? "bg-[#f4b541] text-black"
            : "text-white/48 hover:text-white"
        }`}
      >
        Explore Atlas
      </button>
      <button
        type="button"
        onClick={() => onChange("create")}
        className={`min-h-12 rounded-full px-4 text-sm font-black uppercase tracking-[0.16em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          mode === "create"
            ? "bg-[#f4b541] text-black"
            : "text-white/48 hover:text-white"
        }`}
      >
        Create Memory
      </button>
    </div>
  );
}

function CreateMemoryPanel({
  countries,
  onExplore,
}: {
  countries: string[];
  onExplore: () => void;
}) {
  const [walletStatus, setWalletStatus] = useState<"checking" | "connected" | "disconnected">(
    "checking",
  );
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState("story");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<{
    tone: "idle" | "success" | "error";
    message: string;
  }>({
    tone: "idle",
    message:
      "Required on-chain fields: latitude, longitude, and IPFS metadata URI.",
  });
  const walletConnected = walletStatus === "connected";
  const canSubmit = walletConnected && latitude.trim() && longitude.trim() && metadataURI.trim();

  const refreshWalletConnection = useCallback(async () => {
    const connected = await isWalletConnected();
    setWalletStatus(connected ? "connected" : "disconnected");
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void refreshWalletConnection();
    }, 0);

    const handleAccountsChanged = () => {
      void refreshWalletConnection();
    };

    const handleWalletChanged = () => {
      void refreshWalletConnection();
    };

    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);
    window.addEventListener("atlas:wallet-changed", handleWalletChanged);

    return () => {
      window.clearTimeout(initialCheck);
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
      window.removeEventListener("atlas:wallet-changed", handleWalletChanged);
    };
  }, [refreshWalletConnection]);

  useEffect(() => {
    if (walletConnected) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setTitle("");
      setCountry("");
      setKind("story");
      setLatitude("");
      setLongitude("");
      setMetadataURI("");
      setDescription("");
      setStatus({
        tone: "idle",
        message: "Connect your wallet first to create an on-chain memory.",
      });
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [walletConnected]);

  const submitMemory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletConnected) {
      setStatus({
        tone: "error",
        message: "Connect your wallet first, then you can create a memory.",
      });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setStatus({ tone: "error", message: "Latitude must be between -90 and 90." });
      return;
    }

    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      setStatus({ tone: "error", message: "Longitude must be between -180 and 180." });
      return;
    }

    if (!metadataURI.startsWith("ipfs://")) {
      setStatus({
        tone: "error",
        message: "Use an IPFS URI, for example ipfs://bafy...",
      });
      return;
    }

    if (!ATLAS_CONTRACT_ADDRESS) {
      setStatus({
        tone: "error",
        message:
          "Set NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS to publish this memory on-chain.",
      });
      return;
    }

    if (!window.ethereum) {
      setStatus({
        tone: "error",
        message: "Connect an EVM wallet like Core or MetaMask first.",
      });
      return;
    }

    try {
      setStatus({ tone: "idle", message: "Preparing wallet transaction..." });
      await ensureAvalancheFuji(window.ethereum);
      const [account] = await window.ethereum.request<string[]>({
        method: "eth_requestAccounts",
      });

      if (!account) {
        throw new Error("No wallet account returned.");
      }

      const txHash = await window.ethereum.request<string>({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: ATLAS_CONTRACT_ADDRESS,
            data: encodeCreateMemoryCalldata(
              toE6(lat),
              toE6(lng),
              metadataURI.trim(),
            ),
          },
        ],
      });

      setStatus({
        tone: "success",
        message: `Memory submitted. Transaction: ${txHash.slice(0, 10)}...${txHash.slice(-6)}`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Transaction was not submitted.",
      });
    }
  };

  return (
    <section className="absolute inset-x-4 bottom-4 top-44 z-20 mx-auto max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-black/62 p-5 shadow-2xl shadow-black/45 backdrop-blur-xl sm:top-28 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f4b541]">
            create on-chain
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-none text-white md:text-6xl">
            Create your Atlas memory
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/62">
            Connect your wallet, add a location, and anchor your IPFS memory metadata on Avalanche.
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-[#0d0d10]/92 p-5 shadow-2xl shadow-black/30 md:p-8">
          {walletStatus === "checking" ? (
            <div className="grid min-h-[34rem] place-items-center rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
              <div className="max-w-md">
                <h2 className="text-3xl font-semibold leading-tight text-white">
                  Checking wallet
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Atlas is checking your wallet connection before opening the memory form.
                </p>
              </div>
            </div>
          ) : !walletConnected ? (
            <div className="grid min-h-[34rem] place-items-center rounded-3xl border border-[#f4b541]/25 bg-[#f4b541]/10 p-8 text-center">
              <div className="max-w-md">
                <h2 className="text-3xl font-semibold leading-tight text-white">
                  Connect to create
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/62">
                  Use the Connect Wallet button in the top-right to unlock the memory form and publish your Atlas pin on-chain.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={submitMemory}>
              <div className="mb-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-white/58">
                Required on-chain: <strong className="text-white">latitude</strong>,{" "}
                <strong className="text-white">longitude</strong>, and{" "}
                <strong className="text-white">IPFS metadata URI</strong>.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-white/76">Memory title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="The night we won together"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-white/76">Country</span>
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder={countries[0] || "Japan"}
                    list="atlas-countries"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                  <datalist id="atlas-countries">
                    {countries.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>

                <label>
                  <span className="text-sm font-bold text-white/76">Memory type</span>
                  <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <option value="story">Story</option>
                    <option value="photo">Photo</option>
                    <option value="voice">Voice</option>
                    <option value="video">Video</option>
                  </select>
                </label>

                <label>
                  <span className="text-sm font-bold text-white/76">Latitude *</span>
                  <input
                    required
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                    placeholder="1.352083"
                    inputMode="decimal"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </label>

                <label>
                  <span className="text-sm font-bold text-white/76">Longitude *</span>
                  <input
                    required
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                    placeholder="103.625213"
                    inputMode="decimal"
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-white/76">IPFS metadata URI *</span>
                  <input
                    required
                    value={metadataURI}
                    onChange={(event) => setMetadataURI(event.target.value)}
                    placeholder="ipfs://bafy..."
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="text-sm font-bold text-white/76">Memory note</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What happened here?"
                    rows={4}
                    className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold leading-6 text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[#f4b541] px-6 text-sm font-black text-black transition-transform duration-150 hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-white/14 disabled:text-white/36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Create memory on-chain
                </button>
                <button
                  type="button"
                  onClick={onExplore}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 text-sm font-bold text-white/76 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Explore first
                </button>
              </div>

              <p
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${
                  status.tone === "error"
                    ? "border-red-400/25 bg-red-500/10 text-red-100"
                    : status.tone === "success"
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.035] text-white/58"
                }`}
                role="status"
              >
                {status.message}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

async function ensureAvalancheFuji(provider: EthereumProvider) {
  const currentChainId = await provider.request<string>({ method: "eth_chainId" });

  if (currentChainId.toLowerCase() === AVALANCHE_FUJI.chainId) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: AVALANCHE_FUJI.chainId }],
    });
  } catch (switchError) {
    if (
      typeof switchError === "object" &&
      switchError !== null &&
      "code" in switchError &&
      (switchError as { code?: number }).code === 4902
    ) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [AVALANCHE_FUJI],
      });
      return;
    }

    throw switchError;
  }
}

function toE6(value: number) {
  return Math.round(value * 1_000_000);
}

function encodeCreateMemoryCalldata(latitudeE6: number, longitudeE6: number, metadataURI: string) {
  const selector = "1309910b";
  const encodedLatitude = encodeInt256(BigInt(latitudeE6));
  const encodedLongitude = encodeInt256(BigInt(longitudeE6));
  const encodedOffset = encodeUint256(BigInt(96));
  const encodedMetadata = encodeString(metadataURI);

  return `0x${selector}${encodedLatitude}${encodedLongitude}${encodedOffset}${encodedMetadata}`;
}

function encodeInt256(value: bigint) {
  const maxUint256 = BigInt(1) << BigInt(256);
  const encoded = value < BigInt(0) ? maxUint256 + value : value;
  return encoded.toString(16).padStart(64, "0");
}

function encodeUint256(value: bigint) {
  return value.toString(16).padStart(64, "0");
}

function encodeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const paddingLength = (64 - (hex.length % 64)) % 64;
  return `${encodeUint256(BigInt(bytes.length))}${hex}${"0".repeat(paddingLength)}`;
}

function TopBar() {
  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex items-start justify-between gap-4 p-4 sm:p-6">
      <Link
        href="/"
        className="pointer-events-auto inline-flex min-h-11 items-center gap-3 rounded-full border border-white/12 bg-black/40 px-4 text-sm font-semibold text-white shadow-2xl shadow-black/30 backdrop-blur-md transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
      >
        <Image
          src="/logo/logo.png"
          alt="Atlas"
          width={104}
          height={42}
          priority
          className="h-8 w-auto"
        />
        <span className="text-white/64">globe</span>
      </Link>

      <div className="pointer-events-auto">
        <ConnectWalletButton />
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
      className="pointer-events-auto absolute bottom-6 left-1/2 z-30 w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2"
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
    <aside className="pointer-events-none absolute bottom-28 left-4 right-4 z-20 sm:bottom-auto sm:right-auto sm:top-24 sm:w-72">
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
    <div className="pointer-events-none absolute bottom-24 right-4 z-20 rounded-full border border-white/10 bg-black/48 px-4 py-3 text-xs text-white/64 shadow-2xl shadow-black/30 backdrop-blur-md">
      <span className="mr-2 inline-block size-2 rounded-full bg-[#9B45FE] shadow-[0_0_16px_rgba(155,69,254,0.85)]" />
      {label} · {memoryCount} memories
    </div>
  );
}

function SelectedCountryPanel({
  memories,
  stat,
  onClose,
}: {
  memories: typeof ATLAS_MEMORIES;
  stat: CountryStat;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const filteredMemories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return memories;
    }

    return memories.filter((memory) =>
      [memory.title, memory.kind, getMemoryCreator(memory)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [memories, query]);
  const memoryLabel = stat.count === 1 ? "memory" : "memories";

  return (
    <div className="absolute inset-0 z-40">
      <button
        aria-label="Close country memories"
        className="country-memory-backdrop absolute inset-0 cursor-default bg-black/58 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />

      <section className="country-memory-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[82svh] w-full overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#08080b]/95 shadow-[0_-28px_120px_rgba(0,0,0,0.78)] backdrop-blur-2xl md:max-h-[76svh]">
        <div className="mx-auto mt-4 h-1.5 w-20 rounded-full bg-white/28" />

        <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-5 px-5 pb-5 pt-8 md:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#9B45FE] text-2xl font-black text-[#f4b541] shadow-[0_18px_60px_rgba(155,69,254,0.34)]">
              A
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-4xl font-semibold leading-none text-white md:text-5xl">
                {stat.country}
              </h2>
              <p className="mt-2 text-base font-semibold text-white/52">
                <span className="text-[#f4b541]">{stat.count}</span> {memoryLabel} pinned here
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="grid min-h-12 min-w-12 place-items-center rounded-full border border-white/12 bg-white/[0.05] text-2xl text-white/76 transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Close country memories"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mx-auto w-full max-w-7xl border-t border-white/10 px-5 py-5 md:px-8">
          <label className="sr-only" htmlFor="memory-search">
            Search memories in {stat.country}
          </label>
          <input
            id="memory-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${stat.count} ${memoryLabel}...`}
            className="h-14 w-full rounded-full border border-white/10 bg-white/[0.055] px-6 text-base font-semibold text-white placeholder:text-white/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B45FE] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          />
        </div>

        <div className="mx-auto max-h-[44svh] w-full max-w-7xl overflow-y-auto px-5 pb-8 md:max-h-[42svh] md:px-8">
          {filteredMemories.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredMemories.map((memory, index) => (
                <MemoryCard key={memory.id} memory={memory} index={index} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
              <h3 className="text-xl font-semibold text-white">No matching memories</h3>
              <p className="mt-2 text-sm leading-6 text-white/54">
                Try searching by story, memory type, or creator name.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MemoryCard({
  memory,
  index,
}: {
  memory: (typeof ATLAS_MEMORIES)[number];
  index: number;
}) {
  const creator = getMemoryCreator(memory);
  const gradient = getMemoryGradient(index);

  return (
    <article
      className="country-memory-card overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d10] shadow-2xl shadow-black/25"
      style={{
        animationDelay: `${COUNTRY_DRAWER_TIMING.cardInitialDelayMs + index * COUNTRY_DRAWER_TIMING.cardStaggerMs}ms`,
      }}
    >
      <div className={`relative h-36 ${gradient}`}>
        <div className="absolute right-4 top-4 rounded-xl border border-white/12 bg-black/22 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/76 backdrop-blur-md">
          {memory.kind}
        </div>
        <div className="absolute -bottom-8 left-7 grid size-20 place-items-center rounded-full border-4 border-[#0d0d10] bg-[#2084a8] text-3xl font-black text-white shadow-xl">
          {creator.slice(1, 2).toUpperCase()}
        </div>
      </div>

      <div className="px-7 pb-7 pt-11">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-black leading-none text-white">{creator}</h3>
          <span className="rounded-full bg-white/[0.07] px-3 py-1.5 text-xs font-bold text-white/58">
            {formatCoordinate(memory.coordinates.lat)}, {formatCoordinate(memory.coordinates.lng)}
          </span>
        </div>
        <p className="mt-5 text-lg font-semibold leading-7 text-white/82">{memory.title}</p>
        <p className="mt-3 text-sm leading-6 text-white/48">
          A public Atlas memory anchored to this place for others to discover, celebrate, and remember.
        </p>
      </div>
    </article>
  );
}

function getMemoryCreator(memory: (typeof ATLAS_MEMORIES)[number]) {
  return `@${memory.id.split("-")[0]}`;
}

function getMemoryGradient(index: number) {
  const gradients = [
    "bg-[linear-gradient(135deg,#4c1d95,#8b3a74)]",
    "bg-[linear-gradient(135deg,#14532d,#1d4ed8)]",
    "bg-[linear-gradient(135deg,#7c2d12,#6d28d9)]",
    "bg-[linear-gradient(135deg,#0f766e,#334155)]",
  ];

  return gradients[index % gradients.length];
}

function formatCoordinate(value: number) {
  return value.toFixed(2);
}
