export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/[0.78] backdrop-blur-xl">
      <nav className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        <a
          href="#top"
          className="flex min-h-11 items-center gap-3 rounded-full text-2xl font-semibold tracking-[0.02em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          atlas
        </a>

        <div className="hidden items-center gap-10 text-sm font-medium text-white/62 md:flex">
          <a
            href="#how-it-works"
            className="rounded-full px-3 py-2 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4b541] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            How it works
          </a>
        </div>

        <button className="primary-wallet-button">
         
          Connect Wallet
        </button>
      </nav>
    </header>
  );
}
