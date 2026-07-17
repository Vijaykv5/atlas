"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import { ToastContainer, toast } from "react-toastify";
import { ConnectWalletButton } from "@/components/landing/ConnectWalletButton";
import {
  ATLAS_MEMORIES,
  COUNTRY_COORDS,
  type AtlasMemory,
  type CountryStat,
  getGeoCountryName,
  getCountryStats,
  normalizeCountry,
} from "@/lib/atlas-globe-data";
import { isWalletConnected, type EthereumProvider } from "@/utils/wallet";

type AtlasMode = "explore" | "create";

type SavedMemoryResponse = {
  id: string;
  txHash: string;
  creatorAddress: string;
  title: string;
  country: string;
  kind: string;
  description: string;
  imageCid: string;
  imageDataUrl: string;
  voiceDataUrl: string;
  nftTokenId: string;
  createdAt: string;
};

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
const ATLAS_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_ATLAS_PUBLIC_APP_URL;

const BuilderGlobe = dynamic(() => import("./BuilderGlobe"), {
  ssr: false,
  loading: () => <GlobeLoadingState />,
});

const COUNTRY_DRAWER_TIMING = {
  cardInitialDelayMs: 120,
  cardStaggerMs: 45,
};

const MAX_DB_MEDIA_FILE_BYTES = 2.5 * 1024 * 1024;

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

function mergeMemoryRows(newRows: SavedMemoryResponse[], currentRows: SavedMemoryResponse[]) {
  const map = new Map<string, SavedMemoryResponse>();

  for (const memory of [...newRows, ...currentRows]) {
    map.set(memory.txHash || memory.id, memory);
  }

  return [...map.values()];
}

function mergeMemories(newMemories: AtlasMemory[], currentMemories: AtlasMemory[]) {
  const map = new Map<string, AtlasMemory>();

  for (const memory of [...newMemories, ...currentMemories]) {
    map.set(memory.txHash || memory.id, memory);
  }

  return [...map.values()];
}

function toAtlasMemory(
  memory: SavedMemoryResponse,
  countryCoordinates: Record<string, { lat: number; lng: number }>,
): AtlasMemory | null {
  const country = normalizeCountry(memory.country);
  if (!country) {
    return null;
  }

  const coordinates = countryCoordinates[country] || COUNTRY_COORDS[country];
  if (!coordinates) {
    return null;
  }

  return {
    id: `db-${memory.id}`,
    title: memory.title,
    country,
    kind: memory.kind,
    creator: memory.creatorAddress,
    txHash: memory.txHash,
    description: memory.description,
    imageCid: memory.imageCid,
    imageDataUrl: memory.imageDataUrl,
    voiceDataUrl: memory.voiceDataUrl,
    createdAt: memory.createdAt,
    coordinates,
  };
}

function getFeatureCenter(feature: {
  geometry?: { coordinates?: unknown };
} | null) {
  const points: Array<{ lat: number; lng: number }> = [];
  collectLngLatPoints(feature?.geometry?.coordinates, points);

  if (points.length === 0) {
    return null;
  }

  const bounds = points.reduce(
    (currentBounds, point) => ({
      minLat: Math.min(currentBounds.minLat, point.lat),
      maxLat: Math.max(currentBounds.maxLat, point.lat),
      minLng: Math.min(currentBounds.minLng, point.lng),
      maxLng: Math.max(currentBounds.maxLng, point.lng),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lng: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function collectLngLatPoints(value: unknown, points: Array<{ lat: number; lng: number }>) {
  if (!Array.isArray(value)) {
    return;
  }

  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    points.push({ lng: value[0], lat: value[1] });
    return;
  }

  for (const item of value) {
    collectLngLatPoints(item, points);
  }
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
  const [focusedCountry, setFocusedCountry] = useState<string | null>(null);
  const [searchableCountries, setSearchableCountries] = useState<string[]>([]);
  const [countryCoordinates, setCountryCoordinates] = useState(COUNTRY_COORDS);
  const [savedMemoryRows, setSavedMemoryRows] = useState<SavedMemoryResponse[]>([]);

  const savedMemories = useMemo(
    () =>
      savedMemoryRows
        .map((memory) => toAtlasMemory(memory, countryCoordinates))
        .filter((memory): memory is AtlasMemory => Boolean(memory)),
    [countryCoordinates, savedMemoryRows],
  );
  const allMemories = useMemo(
    () => mergeMemories(savedMemories, ATLAS_MEMORIES),
    [savedMemories],
  );
  const countryStats = useMemo(() => getCountryStats(allMemories), [allMemories]);
  const selectedStat = selectedCountry
    ? countryStats.find((item) => item.country === selectedCountry) || {
        country: selectedCountry,
        count: 0,
      }
    : null;
  const selectedMemories = useMemo(
    () =>
      selectedCountry
        ? allMemories.filter((memory) => normalizeCountry(memory.country) === selectedCountry)
        : [],
    [allMemories, selectedCountry],
  );

  const clearSelection = useCallback(() => {
    setSelectedCountry(null);
    setFocusedCountry(null);
  }, []);

  const changeMode = useCallback((nextMode: AtlasMode) => {
    setMode(nextMode);
    setSelectedCountry(null);
    setFocusedCountry(null);

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
      .then(
        (data: {
          features?: Array<{
            properties?: Record<string, unknown>;
            geometry?: { coordinates?: unknown };
          }>;
        }) => {
        if (cancelled) {
          return;
        }

        const nextCountryCoordinates: Record<string, { lat: number; lng: number }> = {
          ...COUNTRY_COORDS,
        };
        for (const feature of data.features || []) {
          const country = normalizeCountry(getGeoCountryName(feature));
          const center = getFeatureCenter(feature);
          if (country && center) {
            nextCountryCoordinates[country] = center;
          }
        }

        const countries = Array.from(
          new Set(
            (data.features || [])
              .map((feature) => normalizeCountry(getGeoCountryName(feature)))
              .filter((country): country is string => Boolean(country) && country !== "Antarctica"),
          ),
        ).sort((a, b) => a.localeCompare(b));

        setCountryCoordinates(nextCountryCoordinates);
        setSearchableCountries(countries);
        },
      )
      .catch((error) => {
        console.error("Failed to load searchable countries:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/memories")
      .then((response) => response.json())
      .then((data: { memories?: SavedMemoryResponse[] }) => {
        if (cancelled) {
          return;
        }

        setSavedMemoryRows(data.memories || []);
      })
      .catch((error) => {
        console.error("Failed to load saved Atlas memories:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleMemorySaved = useCallback((memory: SavedMemoryResponse) => {
    setSavedMemoryRows((currentMemories) => mergeMemoryRows([memory], currentMemories));
  }, []);

  const handleSelectCountry = useCallback((country: string) => {
    setSelectedCountry(country);
    setFocusedCountry(country);
  }, []);

  const handleFocusCountry = useCallback((country: string) => {
    setFocusedCountry(country);
    setSelectedCountry(null);
  }, []);

  const handleCountryHover = useCallback(() => {}, []);

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
          memories={allMemories}
          highlightedCountry={selectedCountry || focusedCountry}
          onCountryClick={handleSelectCountry}
          onCountryHover={handleCountryHover}
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
          focusedCountry={focusedCountry || selectedCountry}
          onFocusCountry={handleFocusCountry}
        />
      ) : null}

      {mode === "create" ? (
        <CreateMemoryPanel
          countries={searchableCountries}
          onMemorySaved={handleMemorySaved}
        />
      ) : null}

      {mode === "explore" && !selectedCountry ? (
        <>
          <CountryRail
            countryStats={countryStats}
            selectedCountry={focusedCountry || selectedCountry}
            onSelect={handleSelectCountry}
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
  onMemorySaved,
}: {
  countries: string[];
  onMemorySaved: (memory: SavedMemoryResponse) => void;
}) {
  const [walletStatus, setWalletStatus] = useState<"checking" | "connected" | "disconnected">(
    "checking",
  );
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState("story");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const walletConnected = walletStatus === "connected";
  const canSubmit =
    walletConnected &&
    !isSubmitting &&
    title.trim() &&
    country.trim() &&
    kind.trim() &&
    description.trim() &&
    imageFile;

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
      setDescription("");
      setImageFile(null);
      setVoiceFile(null);
      setFormError("");
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [walletConnected]);

  const submitMemory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!walletConnected) {
      setFormError("Connect your wallet before publishing.");
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedCountry = country.trim();
    const trimmedKind = kind.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle || !trimmedCountry || !trimmedKind || !trimmedDescription || !imageFile) {
      setFormError("Fill every field before publishing.");
      return;
    }

    if (!ATLAS_CONTRACT_ADDRESS) {
      setFormError("Set NEXT_PUBLIC_ATLAS_CONTRACT_ADDRESS to publish on-chain.");
      return;
    }

    if (!window.ethereum) {
      setFormError("Connect an EVM wallet like Core or MetaMask first.");
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError("");
      const [imageDataUrl, voiceDataUrl] = await Promise.all([
        fileToDataURL(imageFile),
        voiceFile ? fileToDataURL(voiceFile) : Promise.resolve(""),
      ]);
      const mediaId = await createMediaId(imageDataUrl);
      const metadataUrl = createNftMetadataUrl(mediaId);
      await saveNftAsset({
        mediaId,
        title: trimmedTitle,
        country: trimmedCountry,
        kind: trimmedKind,
        description: trimmedDescription,
        imageDataUrl,
        voiceDataUrl,
      });
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
              trimmedTitle,
              trimmedCountry,
              trimmedKind,
              trimmedDescription,
              metadataUrl,
            ),
          },
        ],
      });
      const nftTokenId = await waitForMintedMemoryTokenId(
        window.ethereum,
        txHash,
        ATLAS_CONTRACT_ADDRESS,
      );

      const saveResponse = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          txHash,
          creatorAddress: account,
          title: trimmedTitle,
          country: trimmedCountry,
          kind: trimmedKind,
          description: trimmedDescription,
          imageCid: metadataUrl,
          imageDataUrl,
          voiceDataUrl,
          contractAddress: ATLAS_CONTRACT_ADDRESS,
          nftTokenId,
        }),
      });
      const savedResult = (await saveResponse.json().catch(() => null)) as {
        memory?: SavedMemoryResponse;
        error?: string;
      } | null;

      if (!saveResponse.ok || !savedResult?.memory) {
        throw new Error(savedResult?.error || "Memory was submitted on-chain, but DB save failed.");
      }

      onMemorySaved(savedResult.memory);

      toast.success(
        <a
          href={`https://testnet.snowtrace.io/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-sm leading-6 text-white no-underline"
        >
          <span className="block font-black">Memory creation successful</span>
          <span className="block text-white/72">
            {nftTokenId
              ? `Minted Atlas Memory NFT #${nftTokenId}`
              : "NFT mint submitted"}
          </span>
        </a>,
        {
          toastId: txHash,
        },
      );
      setTitle("");
      setCountry("");
      setKind("story");
      setDescription("");
      setImageFile(null);
      setVoiceFile(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Transaction was not submitted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="absolute inset-x-4 bottom-5 top-36 z-20 mx-auto max-w-[58rem] overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/62 p-4 shadow-2xl shadow-black/45 backdrop-blur-xl sm:top-28 md:p-5">
        <div className="mx-auto flex h-full max-w-3xl flex-col justify-center">
          <div className="mb-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f4b541]">
              create on-chain
            </p>
            <h1 className="mt-2 text-4xl font-semibold leading-none text-white md:text-5xl">
              Create your Atlas memory
            </h1>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-[#0d0d10]/92 p-4 shadow-2xl shadow-black/30 md:p-5">
            {walletStatus === "checking" ? (
              <div className="grid min-h-[22rem] place-items-center rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
                <div className="max-w-md">
                  <h2 className="text-3xl font-semibold leading-tight text-white">
                    Checking wallet
                  </h2>
                </div>
              </div>
            ) : !walletConnected ? (
              <div className="grid min-h-[22rem] place-items-center rounded-3xl border border-[#f4b541]/25 bg-[#f4b541]/10 p-8 text-center">
                <div className="max-w-md">
                  <h2 className="text-3xl font-semibold leading-tight text-white">
                    Wallet required
                  </h2>
                </div>
              </div>
            ) : (
              <form onSubmit={submitMemory}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Memory title *
                    </span>
                    <input
                      required
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="The night we won together"
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Memory image *
                    </span>
                    <div className="mt-2 flex min-h-11 items-center rounded-xl border border-dashed border-white/14 bg-white/[0.045] px-4 py-2">
                      <input
                        required
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null;
                          const validationError = validateMediaFile(nextFile, "image");
                          if (validationError) {
                            event.target.value = "";
                            setImageFile(null);
                            setFormError(validationError);
                            return;
                          }

                          setImageFile(nextFile);
                          setFormError("");
                        }}
                        className="w-full text-sm font-semibold text-white/66 file:mr-4 file:min-h-9 file:rounded-full file:border-0 file:bg-[#f4b541] file:px-4 file:text-sm file:font-black file:text-black hover:file:bg-[#ffd37a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      />
                    </div>
                    {imageFile ? (
                      <p className="mt-2 truncate text-xs font-semibold text-white/42">
                        {imageFile.name}
                      </p>
                    ) : null}
                  </label>

                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Voice message
                    </span>
                    <div className="mt-2 flex min-h-11 items-center rounded-xl border border-dashed border-white/14 bg-white/[0.045] px-4 py-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0] ?? null;
                          const validationError = validateMediaFile(nextFile, "audio");
                          if (validationError) {
                            event.target.value = "";
                            setVoiceFile(null);
                            setFormError(validationError);
                            return;
                          }

                          setVoiceFile(nextFile);
                          setFormError("");
                        }}
                        className="w-full text-sm font-semibold text-white/66 file:mr-4 file:min-h-9 file:rounded-full file:border-0 file:bg-white/14 file:px-4 file:text-sm file:font-black file:text-white hover:file:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                      />
                    </div>
                    {voiceFile ? (
                      <p className="mt-2 truncate text-xs font-semibold text-white/42">
                        {voiceFile.name}
                      </p>
                    ) : null}
                  </label>

                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Country *
                    </span>
                    <input
                      required
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      placeholder={countries[0] || "Japan"}
                      list="atlas-countries"
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    />
                    <datalist id="atlas-countries">
                      {countries.map((item) => (
                        <option key={item} value={item} />
                      ))}
                    </datalist>
                  </label>

                  <label>
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Memory type *
                    </span>
                    <select
                      required
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <option value="story">Story</option>
                      <option value="reflection">Reflection</option>
                      <option value="milestone">Milestone</option>
                      <option value="tribute">Tribute</option>
                    </select>
                  </label>

                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/66">
                      Memory note *
                    </span>
                    <textarea
                      required
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="What happened here?"
                      rows={3}
                      className="mt-2 h-16 w-full resize-none rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold leading-6 text-white placeholder:text-white/32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    />
                  </label>
                </div>

                {formError ? (
                  <p
                    className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100"
                    role="alert"
                  >
                    {formError}
                  </p>
                ) : null}

                <div className="mt-5">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    aria-busy={isSubmitting}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#f4b541] px-6 text-sm font-black text-black transition-transform duration-150 hover:scale-[1.01] disabled:cursor-not-allowed disabled:bg-white/14 disabled:text-white/36 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {isSubmitting ? "Saving and publishing..." : "Create memory on-chain"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
      <ToastContainer
        position="bottom-right"
        autoClose={false}
        closeOnClick={false}
        draggable={false}
        theme="dark"
        newestOnTop
        className="atlas-toast-container"
        toastClassName="atlas-toast"
        style={{
          bottom: "1.25rem",
          left: "auto",
          right: "1.25rem",
          top: "auto",
          transform: "none",
          width: "min(calc(100vw - 2rem), 28rem)",
        }}
      />
    </>
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

function encodeCreateMemoryCalldata(
  title: string,
  country: string,
  kind: string,
  description: string,
  imageCid: string,
) {
  return encodeStringCalldata("ed2a4b14", [title, country, kind, description, imageCid]);
}

type TransactionReceipt = {
  status?: string;
  logs?: Array<{
    address?: string;
    topics?: string[];
  }>;
};

async function waitForMintedMemoryTokenId(
  provider: EthereumProvider,
  txHash: string,
  contractAddress: string,
) {
  const receipt = await waitForTransactionReceipt(provider, txHash);

  if (receipt?.status && receipt.status !== "0x1") {
    throw new Error("The memory NFT transaction failed.");
  }

  return extractMemoryTokenId(receipt, contractAddress);
}

async function waitForTransactionReceipt(provider: EthereumProvider, txHash: string) {
  const maxAttempts = 45;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receipt = await provider.request<TransactionReceipt | null>({
      method: "eth_getTransactionReceipt",
      params: [txHash],
    });

    if (receipt) {
      return receipt;
    }

    await sleep(2_000);
  }

  return null;
}

function extractMemoryTokenId(receipt: TransactionReceipt | null, contractAddress: string) {
  const memoryCreatedLog = receipt?.logs?.find((log) => {
    const isAtlasContract = log.address?.toLowerCase() === contractAddress.toLowerCase();
    return isAtlasContract && log.topics?.length === 3;
  });
  const tokenIdTopic = memoryCreatedLog?.topics?.[1];

  if (!tokenIdTopic) {
    return "";
  }

  return BigInt(tokenIdTopic).toString();
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function encodeStringCalldata(selector: string, values: string[]) {
  const encodedValues = values.map(encodeString);
  let currentOffset = values.length * 32;
  const offsets = encodedValues.map((encodedValue) => {
    const offset = encodeUint256(BigInt(currentOffset));
    currentOffset += encodedValue.length / 2;
    return offset;
  });

  return `0x${selector}${offsets.join("")}${encodedValues.join("")}`;
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

function validateMediaFile(file: File | null, expectedType: "image" | "audio") {
  if (!file) {
    return "";
  }

  if (!file.type.startsWith(`${expectedType}/`)) {
    return expectedType === "image" ? "Choose an image file." : "Choose an audio file.";
  }

  if (file.size > MAX_DB_MEDIA_FILE_BYTES) {
    return `${expectedType === "image" ? "Image" : "Voice"} must be smaller than 2.5 MB.`;
  }

  return "";
}

function fileToDataURL(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read media file."));
    reader.readAsDataURL(file);
  });
}

async function createMediaId(imageDataUrl: string) {
  const bytes = new TextEncoder().encode(imageDataUrl);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function createNftMetadataUrl(mediaId: string) {
  const publicAppUrl = getPublicAppUrl();

  return `${publicAppUrl}/api/memories/metadata/${mediaId}`;
}

async function saveNftAsset(asset: {
  mediaId: string;
  title: string;
  country: string;
  kind: string;
  description: string;
  imageDataUrl: string;
  voiceDataUrl: string;
}) {
  const response = await fetch("/api/memories/assets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(asset),
  });
  const result = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(result?.error || "Could not prepare NFT metadata.");
  }
}

function getPublicAppUrl() {
  const configuredUrl = ATLAS_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  return window.location.origin;
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
  focusedCountry,
  onFocusCountry,
}: {
  countries: string[];
  focusedCountry: string | null;
  onFocusCountry: (country: string) => void;
}) {
  const [query, setQuery] = useState(focusedCountry || "");

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

      onFocusCountry(resolvedCountry);
      setQuery(resolvedCountry);
    },
    [onFocusCountry, resolveCountry],
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
  const hasImage = Boolean(memory.imageDataUrl);

  return (
    <article
      className="country-memory-card overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d10] shadow-2xl shadow-black/25"
      style={{
        animationDelay: `${COUNTRY_DRAWER_TIMING.cardInitialDelayMs + index * COUNTRY_DRAWER_TIMING.cardStaggerMs}ms`,
      }}
    >
      <div className={`relative h-36 ${hasImage ? "bg-black" : gradient}`}>
        {memory.imageDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={memory.imageDataUrl}
            alt={memory.title}
            className="h-full w-full object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10" />
        <div className="absolute right-4 top-4 rounded-xl border border-white/12 bg-black/38 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/82 backdrop-blur-md">
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
        {memory.voiceDataUrl ? (
          <audio
            controls
            src={memory.voiceDataUrl}
            className="mt-5 h-10 w-full"
          >
            <track kind="captions" />
          </audio>
        ) : null}
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
