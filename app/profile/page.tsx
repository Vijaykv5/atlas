import Image from "next/image";
import Link from "next/link";
import { ConnectWalletButton } from "@/components/landing/ConnectWalletButton";

export const metadata = {
  title: "Atlas Profile",
  description: "Manage your Atlas wallet profile.",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-black px-5 py-6 text-white md:px-8">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <Link
          href="/atlas"
          className="inline-flex min-h-11 items-center gap-3 rounded-full border border-white/12 bg-white/[0.04] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Image
            src="/logo/logo.png"
            alt="Atlas"
            width={104}
            height={42}
            priority
            className="h-8 w-auto"
          />
        </Link>
        <ConnectWalletButton />
      </header>

      <section className="mx-auto mt-20 w-full max-w-5xl">
        <p className="text-sm font-black uppercase tracking-[0.28em] text-[#f4b541]">
          wallet profile
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.95] text-white md:text-7xl">
          Your Atlas profile
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/62">
          This is where your connected wallet, pinned memories, and on-chain Atlas activity can live.
        </p>
      </section>
    </main>
  );
}
