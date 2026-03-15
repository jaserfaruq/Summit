import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-off-white flex flex-col">
      <header className="bg-forest px-6 py-4">
        <h1 className="text-white text-xl font-bold">Summit Planner</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-forest mb-4">
            Summit Planner
          </h2>
          <p className="text-gray-600 mb-8">
            Plan your next summit with ease.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-burnt-orange hover:bg-burnt-orange/90 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="border-2 border-forest text-forest hover:bg-forest hover:text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
