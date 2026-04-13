import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const { t } = useTranslation();
  const onFocused =
    location.pathname.startsWith("/study");

  return (
    <div className="min-h-screen flex flex-col bg-rice bg-grain">
      {/* Desktop top nav — hidden on mobile */}
      {!onFocused && (
        <header className="hidden sm:block pt-4 pb-3 border-b border-ink-100 bg-paper/80 backdrop-blur-sm">
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
            <nav className="flex items-center gap-1.5">
              <Link
                to="/"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-vermillion-500 hover:bg-vermillion-50 [&.active]:text-vermillion-600 [&.active]:bg-vermillion-50 transition-colors"
              >
                {t("nav.home")}
              </Link>
              <Link
                to="/study"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-jade-600 hover:bg-jade-50 [&.active]:text-jade-600 [&.active]:bg-jade-50 transition-colors"
              >
                {t("nav.study")}
              </Link>
              <Link
                to="/stats"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-gold-600 hover:bg-gold-50 [&.active]:text-gold-600 [&.active]:bg-gold-50 transition-colors"
              >
                {t("nav.stats")}
              </Link>
              <Link
                to="/settings"
                className="px-4 py-2 rounded-lg text-sm font-semibold text-ink-400 hover:text-ink-600 hover:bg-ink-50 [&.active]:text-ink-600 [&.active]:bg-ink-100 transition-colors"
              >
                {t("nav.settings")}
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 relative z-10 pb-20 sm:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      {!onFocused && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-ink-100 bg-paper/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-stretch justify-around">
            <Link
              to="/"
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-ink-400 [&.active]:text-vermillion-500 transition-colors"
            >
              <span className="text-xl leading-none">&#x2302;</span>
              <span className="text-[10px] font-semibold">{t("nav.home")}</span>
            </Link>
            <Link
              to="/study"
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-ink-400 [&.active]:text-jade-500 transition-colors"
            >
              <span className="font-hanzi text-xl leading-none font-bold">筆</span>
              <span className="text-[10px] font-semibold">{t("nav.study")}</span>
            </Link>
            <Link
              to="/stats"
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-ink-400 [&.active]:text-gold-500 transition-colors"
            >
              <span className="text-xl leading-none">&#x2637;</span>
              <span className="text-[10px] font-semibold">{t("nav.stats")}</span>
            </Link>
            <Link
              to="/settings"
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-ink-400 [&.active]:text-ink-600 transition-colors"
            >
              <span className="text-xl leading-none">&#x2699;</span>
              <span className="text-[10px] font-semibold">{t("nav.settings")}</span>
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}
