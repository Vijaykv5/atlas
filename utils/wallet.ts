export type EthereumProvider = {
  request: <T = unknown>(args: {
    method: string;
    params?: unknown[] | Record<string, unknown>;
  }) => Promise<T>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
};

const ATLAS_WALLET_DISCONNECTED_KEY = "atlas.wallet.disconnected";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function markWalletConnected() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ATLAS_WALLET_DISCONNECTED_KEY);
}

export function markWalletDisconnected() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ATLAS_WALLET_DISCONNECTED_KEY, "true");
}

export function isWalletMarkedDisconnected() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(ATLAS_WALLET_DISCONNECTED_KEY) === "true";
}

export async function getConnectedAccounts(provider = window.ethereum) {
  if (!provider) {
    return [];
  }

  try {
    return await provider.request<string[]>({ method: "eth_accounts" });
  } catch {
    return [];
  }
}

export async function isWalletConnected(provider = window.ethereum) {
  if (isWalletMarkedDisconnected()) {
    return false;
  }

  const accounts = await getConnectedAccounts(provider);
  return accounts.length > 0;
}

export async function revokeWalletPermissions(provider = window.ethereum) {
  if (!provider) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_revokePermissions",
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // Not every EVM wallet supports programmatic permission revocation.
    // Atlas still marks the session disconnected locally.
  }
}
