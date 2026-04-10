import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const onFocused =
    location.pathname.startsWith("/review") ||
    location.pathname.startsWith("/study");

  return (
    <div className="min-h-screen flex flex-col bg-rice bg-grain">
      {!onFocused && (
        <header className="pt-4 pb-3 border-b border-ink-100 bg-paper/80 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-5 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <span
                aria-hidden
                className="grid place-items-center h-10 w-10 rounded-lg bg-vermillion-500 shadow-[0_3px_0_0_#8c1f2e] group-hover:shadow-glow-vermillion transition-shadow"
              >
                <span className="font-hanzi text-white text-lg font-black">學</span>
              </span>
              <span className="font-display text-xl text-ink-800 tracking-tight">
                HSK Trainer
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-1.5">
              <Link
                to="/"
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-vermillion-500 hover:bg-vermillion-50 [&.active]:text-vermillion-600 [&.active]:bg-vermillion-50 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/study"
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-jade-600 hover:bg-jade-50 [&.active]:text-jade-600 [&.active]:bg-jade-50 transition-colors"
              >
                Study
              </Link>
              <Link
                to="/review"
                className="px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-gold-600 hover:bg-gold-50 [&.active]:text-gold-600 [&.active]:bg-gold-50 transition-colors"
              >
                Review
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
