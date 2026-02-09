// SPEC_042: Homepage
export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-6">
            dIKtate
          </h1>
          <p className="text-2xl text-gray-400 mb-8">
            AI Voice Dictation for Windows
          </p>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Private, fast, intelligent voice-to-text powered by local AI. No cloud, no lag, no compromise.
          </p>

          <div className="mt-12 flex gap-4 justify-center">
            <a
              href="#"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              Download for Windows
            </a>
            <a
              href="/login"
              className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
              Sign Up
            </a>
          </div>

          <div className="mt-16 text-sm text-gray-600">
            <p>✓ 100% Local Processing</p>
            <p>✓ No Subscriptions</p>
            <p>✓ Privacy First</p>
          </div>
        </div>
      </div>
    </main>
  );
}
