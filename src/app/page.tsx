import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Fixed blurred background */}
      <div className="fixed inset-0 -z-10">
        <img src="/bg-mountain.jpg" alt="" className="w-full h-full object-cover blur-md scale-110" />
        <div className="absolute inset-0 bg-black/50" />
      </div>
      <header className="bg-dark-card/80 backdrop-blur-md border-b border-dark-border/50 px-6 py-4">
        <h1 className="text-gold text-xl font-bold">Summit Planner</h1>
      </header>

      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gold mb-4">
            Summit Planner
          </h2>
          <p className="text-dark-muted mb-8">
            Plan your next summit with ease.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-gold hover:bg-gold/90 text-dark-bg font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="border-2 border-gold text-gold hover:bg-gold hover:text-dark-bg font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
