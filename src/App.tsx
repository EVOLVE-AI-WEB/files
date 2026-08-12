import { CONFIG } from './config';

/**
 * Placeholder application shell.
 *
 * Task 1 only establishes the project foundations (tooling, Supabase client,
 * domain types, and centralized CONFIG). Feature screens are implemented in
 * later tasks per the implementation plan.
 */
function App() {
  return (
    <div className="min-h-full bg-app-bg text-brand-navy">
      <main className="mx-auto flex max-w-md flex-col gap-2 p-6">
        <h1 className="text-2xl font-bold">
          <span className="font-bold text-brand-navy">EVOLVE</span>{' '}
          <span className="tracking-widest text-slate-500">FITNESS</span>
        </h1>
        <p className="text-slate-600">
          Macro &amp; Body Composition Calculator — project foundations ready.
        </p>
        <p className="text-sm text-slate-400">
          Default calorie multiplier: {CONFIG.DEFAULT_CALORIE_MULTIPLIER} kcal/lb
        </p>
      </main>
    </div>
  );
}

export default App;
