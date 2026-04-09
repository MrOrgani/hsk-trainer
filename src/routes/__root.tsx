import { Outlet, Link, createRootRoute, useRouterState } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { location } = useRouterState();
  const onReview = location.pathname.startsWith("/review");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {!onReview && (
        <header className="pt-5 pb-3 border-b-2 border-gray-200 bg-white">
          <div className="max-w-5xl mx-auto px-5 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid place-items-center h-11 w-11 rounded-2xl bg-green-500 border-b-4 border-green-700 shadow-sm"
              >
                <span className="font-hanzi text-white text-xl font-black">學</span>
              </span>
              <span className="font-extrabold text-xl text-green-600 tracking-tight">
                HSK Trainer
              </span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/"
                className="px-3 sm:px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-green-600 hover:bg-green-50 [&.active]:text-green-600 [&.active]:bg-green-50 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/review"
                className="px-3 sm:px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-gray-500 hover:text-green-600 hover:bg-green-50 [&.active]:text-green-600 [&.active]:bg-green-50 transition-colors"
              >
                Learn
              </Link>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
