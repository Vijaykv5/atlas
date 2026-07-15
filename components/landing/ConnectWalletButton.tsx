"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getConnectedAccounts,
  isWalletMarkedDisconnected,
  markWalletConnected,
  markWalletDisconnected,
  revokeWalletPermissions,
  type EthereumProvider,
} from "@/utils/wallet";

type Eip6963ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type WalletProvider = {
  info: Eip6963ProviderInfo;
  provider: EthereumProvider;
};

type Eip6963AnnounceProviderEvent = CustomEvent<WalletProvider>;

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

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: number }).code;

    if (code === 4001) {
      return "Connection cancelled in your wallet.";
    }

    if (code === -32002) {
      return "Your wallet already has a pending connection request.";
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Could not connect wallet. Try again.";
}

function notifyWalletChanged() {
  window.dispatchEvent(new Event("atlas:wallet-changed"));
}

export function ConnectWalletButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<WalletProvider[]>([]);
  const [account, setAccount] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<EthereumProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const displayProviderList = useMemo(() => {
    const seen = new Set<string>();

    return providers
      .filter(({ info, provider }) => {
        const key = normalizeWalletKey(info.name || info.rdns || info.uuid);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return Boolean(provider);
      })
      .sort((a, b) => getWalletPriority(a.info.name) - getWalletPriority(b.info.name));
  }, [providers]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const ensureAvalancheFuji = useCallback(async (provider: EthereumProvider) => {
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
      } else {
        throw switchError;
      }
    }

  }, []);

  const connect = useCallback(
    async (provider: EthereumProvider) => {
      setIsConnecting(true);
      setError(null);

      try {
        const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
        const nextAccount = accounts[0];

        if (!nextAccount) {
          throw new Error("No wallet account was returned.");
        }

        setSelectedProvider(provider);
        setAccount(nextAccount);
        await ensureAvalancheFuji(provider);
        markWalletConnected();
        setIsOpen(false);
        notifyWalletChanged();
      } catch (connectError) {
        setError(getErrorMessage(connectError));
      } finally {
        setIsConnecting(false);
      }
    },
    [ensureAvalancheFuji],
  );

  const disconnect = useCallback(() => {
    const provider = selectedProvider || window.ethereum;
    setAccount(null);
    setSelectedProvider(null);
    setError(null);
    setIsAccountMenuOpen(false);
    markWalletDisconnected();
    void revokeWalletPermissions(provider).finally(() => {
      notifyWalletChanged();
    });
  }, [selectedProvider]);

  useEffect(() => {
    if (!account) {
      return;
    }

    markWalletConnected();
    notifyWalletChanged();
  }, [account]);

  useEffect(() => {
    const discoveredProviders = new Map<string, WalletProvider>();

    const addProvider = ({ detail }: Eip6963AnnounceProviderEvent) => {
      discoveredProviders.set(detail.info.uuid, detail);
      setProviders(Array.from(discoveredProviders.values()));
    };

    window.addEventListener(
      "eip6963:announceProvider",
      addProvider as EventListener,
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    if (window.ethereum) {
      window.setTimeout(() => {
        if (isWalletMarkedDisconnected()) {
          return;
        }

        void getConnectedAccounts(window.ethereum).then((accounts) => {
          const nextAccount = accounts[0];

          if (nextAccount) {
            setSelectedProvider(window.ethereum as EthereumProvider);
            setAccount(nextAccount);
            markWalletConnected();
            notifyWalletChanged();
          }
        });

        setProviders((currentProviders) => {
          const hasInjectedFallback = currentProviders.some(
            ({ info }) => info.uuid === "injected-window-ethereum",
          );

          if (hasInjectedFallback) {
            return currentProviders;
          }

          return [
            ...currentProviders,
            {
              info: {
                uuid: "injected-window-ethereum",
                name: window.ethereum?.isMetaMask ? "MetaMask" : "Browser wallet",
                icon: "",
                rdns: "injected",
              },
              provider: window.ethereum as EthereumProvider,
            },
          ];
        });
      }, 0);
    }

    return () => {
      window.removeEventListener(
        "eip6963:announceProvider",
        addProvider as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!selectedProvider?.on || !selectedProvider.removeListener) {
      return;
    }

    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (accounts[0]) {
        markWalletConnected();
      } else {
        markWalletDisconnected();
      }
      setAccount(accounts[0] ?? null);
      notifyWalletChanged();
    };

    selectedProvider.on("accountsChanged", handleAccountsChanged);

    return () => {
      selectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [selectedProvider]);

  useEffect(() => {
    const syncWalletState = () => {
      if (isWalletMarkedDisconnected()) {
        setAccount(null);
        setSelectedProvider(null);
        setIsAccountMenuOpen(false);
        return;
      }

      if (!window.ethereum) {
        setAccount(null);
        setSelectedProvider(null);
        return;
      }

      void getConnectedAccounts(window.ethereum).then((accounts) => {
        const nextAccount = accounts[0] ?? null;
        setAccount(nextAccount);
        setSelectedProvider(nextAccount ? (window.ethereum as EthereumProvider) : null);
      });
    };

    window.addEventListener("atlas:wallet-changed", syncWalletState);

    return () => {
      window.removeEventListener("atlas:wallet-changed", syncWalletState);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, isOpen]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const walletDialog =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="wallet-dialog-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeDialog();
              }
            }}
          >
            <section
              aria-labelledby="wallet-dialog-title"
              aria-modal="true"
              className="wallet-dialog"
              role="dialog"
            >
              <div className="wallet-dialog-header">
                <div>
                  <h2 id="wallet-dialog-title">Connect wallet</h2>
                  <p>Choose an EVM wallet. Atlas will switch it to Avalanche Fuji.</p>
                </div>
                <button
                  aria-label="Close wallet dialog"
                  className="wallet-dialog-close"
                  type="button"
                  onClick={closeDialog}
                >
                  x
                </button>
              </div>

              <div className="wallet-provider-list">
                {displayProviderList.length > 0 ? (
                  displayProviderList.map(({ info, provider }) => (
                    <button
                      className="wallet-provider-button"
                      disabled={isConnecting}
                      key={info.uuid}
                      type="button"
                      onClick={() => void connect(provider)}
                    >
                      <WalletIcon icon={info.icon} name={info.name} />
                      <span className="wallet-provider-copy">
                        <strong>{cleanWalletName(info.name)}</strong>
                      </span>
                      <span className="wallet-provider-arrow" aria-hidden="true">
                        →
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="wallet-empty-state">
                    <strong>No EVM wallet found</strong>
                    <p>Install Core, MetaMask, Rabby, or Brave Wallet, then refresh.</p>
                  </div>
                )}
              </div>

              {error ? (
                <div className="wallet-error" role="alert">
                  <strong>Wallet connection failed</strong>
                  <p>{error}</p>
                </div>
              ) : null}

            </section>
          </div>,
          document.body,
        )
      : null;

  if (account) {
    return (
      <div className="wallet-connected" ref={accountMenuRef}>
        <button
          ref={triggerRef}
          className="primary-wallet-button primary-wallet-button-connected"
          type="button"
          title={account}
          aria-haspopup="menu"
          aria-expanded={isAccountMenuOpen}
          onClick={() => setIsAccountMenuOpen((currentValue) => !currentValue)}
        >
          <span aria-hidden="true" />
          {shortenAddress(account)}
        </button>

        {isAccountMenuOpen ? (
          <div className="wallet-account-menu" role="menu">
            <a href="/profile" role="menuitem" className="wallet-account-menu-item">
              <strong>Profile</strong>
            </a>
            <button
              type="button"
              role="menuitem"
              className="wallet-account-menu-item"
              onClick={disconnect}
            >
              <strong>Disconnect</strong>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        ref={triggerRef}
        className="primary-wallet-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        Connect Wallet
      </button>
      {walletDialog}
    </div>
  );
}

function cleanWalletName(name: string) {
  return name.replace(/\s+Wallet$/i, " Wallet");
}

function normalizeWalletKey(name: string) {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("metamask")) return "metamask";
  if (normalizedName.includes("core")) return "core";
  if (normalizedName.includes("rabby")) return "rabby";
  if (normalizedName.includes("brave")) return "brave";
  if (normalizedName.includes("coinbase")) return "coinbase";
  if (normalizedName.includes("phantom")) return "phantom";
  if (normalizedName.includes("backpack")) return "backpack";

  return normalizedName.trim();
}

function getWalletPriority(name: string) {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("core")) return 0;
  if (normalizedName.includes("metamask")) return 1;
  if (normalizedName.includes("rabby")) return 2;
  if (normalizedName.includes("brave")) return 3;
  if (normalizedName.includes("coinbase")) return 4;

  return 10;
}

function WalletIcon({ icon, name }: { icon: string; name: string }) {
  if (icon) {
    return (
      <span className="wallet-provider-icon-frame" aria-hidden="true">
        {/* Wallets provide tiny data-URI icons; render them directly to avoid broken CSS backgrounds. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt="" />
      </span>
    );
  }

  return (
    <span className="wallet-provider-initial" aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
