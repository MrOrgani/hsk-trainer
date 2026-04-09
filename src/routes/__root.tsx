import { Outlet, Link, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex gap-4 items-center">
        <h1 className="text-xl font-bold">HSK Trainer</h1>
        <nav className="flex gap-3 text-sm">
          <Link to="/" className="hover:underline [&.active]:font-semibold">Home</Link>
          <Link to="/review" className="hover:underline [&.active]:font-semibold">Review</Link>
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
