"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getConnectedAccounts } from "@/utils/wallet";

type ProfileMemory = {
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

const SNOWTRACE_TX_URL = "https://testnet.snowtrace.io/tx";

function shortenHash(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saved on-chain";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load your memories.";
}

export function ProfileMemories() {
  const [account, setAccount] = useState<string | null>(null);
  const [hasCheckedWallet, setHasCheckedWallet] = useState(false);
  const [memories, setMemories] = useState<ProfileMemory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncWallet = useCallback(async () => {
    const accounts = await getConnectedAccounts();
    setAccount(accounts[0] ?? null);
    setHasCheckedWallet(true);
  }, []);

  const loadMemories = useCallback(async () => {
    if (!account) {
      setMemories([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/memories?creator=${encodeURIComponent(account)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        memories?: ProfileMemory[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Could not load your memories.");
      }

      setMemories(result.memories ?? []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError));
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  useEffect(() => {
    // Wallet state is external to React, so the profile syncs once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void syncWallet();

    function handleWalletChanged() {
      void syncWallet();
    }

    function handleAccountsChanged(nextAccounts: unknown) {
      const nextAccount = Array.isArray(nextAccounts)
        ? String(nextAccounts[0] ?? "")
        : "";
      setAccount(nextAccount || null);
      setHasCheckedWallet(true);
    }

    window.addEventListener("atlas:wallet-changed", handleWalletChanged);
    window.ethereum?.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      window.removeEventListener("atlas:wallet-changed", handleWalletChanged);
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [syncWallet]);

  useEffect(() => {
    // Memories are loaded from the API whenever the connected wallet changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMemories();
  }, [loadMemories]);

  return (
    <section className="mx-auto mt-12 w-full max-w-5xl pb-20">
      {!hasCheckedWallet ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : null}

      {hasCheckedWallet && !account ? (
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h3 className="text-xl font-semibold text-white">Wallet needed</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
            Open the wallet menu above and connect the address you used to create
            memories. Atlas will show only the memories saved by that address.
          </p>
        </div>
      ) : null}

      {account && error ? (
        <div className="mt-8 rounded-lg border border-red-400/30 bg-red-500/10 p-6">
          <h3 className="text-xl font-semibold text-white">Could not load memories</h3>
          <p className="mt-3 text-sm leading-6 text-red-100/80">{error}</p>
          <button
            type="button"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#f4b541] px-5 text-sm font-black text-black transition-colors duration-150 hover:bg-[#ffd37a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            onClick={() => void loadMemories()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {account && isLoading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-56 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : null}

      {account && !isLoading && !error && memories.length === 0 ? (
        <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h3 className="text-xl font-semibold text-white">No memories yet</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
            Create an on-chain memory from the Atlas globe and it will appear
            here after the transaction is submitted and saved.
          </p>
          <Link
            href="/atlas"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[#f4b541] px-5 text-sm font-black text-black transition-colors duration-150 hover:bg-[#ffd37a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Create memory
          </Link>
        </div>
      ) : null}

      {account && !isLoading && !error && memories.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-5 transition-colors duration-150 hover:border-[#f4b541]/50"
            >
              {memory.imageDataUrl ? (
                <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-lg bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={memory.imageDataUrl}
                    alt={memory.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b541]">
                    {memory.country}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">
                    {memory.title}
                  </h3>
                </div>
                <span className="shrink-0 rounded-full border border-white/12 bg-black/30 px-3 py-1 text-xs font-bold text-white/70">
                  {memory.kind}
                </span>
              </div>

              <p className="mt-4 line-clamp-4 text-sm leading-6 text-white/64">
                {memory.description}
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

              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-white/56 sm:flex-row sm:items-center sm:justify-between">
                <span>{formatDate(memory.createdAt)}</span>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {memory.nftTokenId ? (
                    <span className="rounded-full border border-[#f4b541]/30 bg-[#f4b541]/10 px-3 py-1 text-xs font-black text-[#f4b541]">
                      NFT #{memory.nftTokenId}
                    </span>
                  ) : null}
                  <a
                    href={`${SNOWTRACE_TX_URL}/${memory.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#f4b541] transition-colors duration-150 hover:text-[#ffd37a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {shortenHash(memory.txHash)}
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
