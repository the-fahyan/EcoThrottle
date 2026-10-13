import React from "react";
import { Activity, Leaf, ShieldCheck } from "lucide-react";

export function App(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 border border-emerald-500/20">
            <Leaf className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">GreenShift</h1>
            <p className="text-xs text-slate-400">Carbon-Aware Intelligent Scheduling Proxy</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
            Grid Optimal
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Current Grid Intensity</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">128 <span className="text-sm font-normal text-slate-400">gCO2/kWh</span></div>
            <p className="text-xs text-emerald-400 mt-2 font-medium">Clean Window Active</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Workloads</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-white">0 <span className="text-sm font-normal text-slate-400">queued</span></div>
            <p className="text-xs text-slate-400 mt-2">Ready for submission</p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Avoided Emissions</span>
              <Leaf className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white">0.00 <span className="text-sm font-normal text-slate-400">kgCO2e</span></div>
            <p className="text-xs text-slate-400 mt-2">Forecast-based estimates</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
