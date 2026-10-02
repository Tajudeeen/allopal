export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div className="inline-block px-3 py-1 bg-blue-100 text-paypal-blue text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
          Allopal Invariant Gate
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Allopal
        </h1>
        <p className="mt-2 text-slate-600 font-medium">
          Spending Authorization Layer for PayPal Agentic Commerce
        </p>
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-left font-mono text-sm text-slate-800">
          <p className="text-emerald-700 font-semibold">MANDATE PASSES &rarr; PAYPAL CAPTURE</p>
          <p className="text-rose-700 font-semibold mt-1">MANDATE FAILS &rarr; NO PAYPAL CALL</p>
        </div>
      </div>
    </main>
  );
}
