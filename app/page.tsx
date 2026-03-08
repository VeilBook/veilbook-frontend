"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Shield, Zap, Lock } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-16 py-10">
      
      {/* Hero Section */}
      <section className="max-w-4xl space-y-6">
        <div className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400 mb-4 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-yellow-400 mr-2 animate-pulse"></span>
          Live on Sepolia Testnet
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-zinc-200 to-zinc-600">
          Confidential limit order book on Uniswap V4
        </h1>
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Powered by Zama FHE. Trade securely with fully encrypted limit orders, ensuring zero MEV entirely on-chain.
        </p>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pools"
            className="group flex items-center justify-center gap-2 rounded-lg bg-white text-black px-8 py-3.5 text-sm font-semibold transition-all hover:bg-zinc-200"
          >
            Explore Pools
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/faucet"
            className="flex items-center justify-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white px-8 py-3.5 text-sm font-medium transition-all hover:bg-zinc-800 hover:border-zinc-700"
          >
            Get Testnet Tokens
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mt-16 px-4">
        
        {/* Feature 1 */}
        <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm transition-all hover:border-yellow-500/50 hover:bg-zinc-900/80">
          <div className="mb-4 inline-flex rounded-xl bg-yellow-500/10 p-3 text-yellow-500">
            <Lock className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">Confidential Orders</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Order amounts are encrypted using Zama FHE. Only you can view your real order size and filled amounts until settlement.
          </p>
        </div>

        {/* Feature 2 */}
        <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm transition-all hover:border-yellow-500/50 hover:bg-zinc-900/80">
          <div className="mb-4 inline-flex rounded-xl bg-yellow-500/10 p-3 text-yellow-500">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">Zero MEV</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            By keeping the order state encrypted before execution, searchers and validators cannot front-run or sandwich your limit orders.
          </p>
        </div>

        {/* Feature 3 */}
        <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm transition-all hover:border-yellow-500/50 hover:bg-zinc-900/80">
          <div className="mb-4 inline-flex rounded-xl bg-yellow-500/10 p-3 text-yellow-500">
            <Zap className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-white">P2P Settlement</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Orders are matched directly using Uniswap V4 hooks. When the pool price crosses your limit tick, settlements occur seamlessly behind the scenes.
          </p>
        </div>

      </section>

      {/* Decorative Background Glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black opacity-80" />
      <div className="pointer-events-none fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-yellow-500/5 blur-[120px] -z-10" />
      <div className="pointer-events-none fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-yellow-500/5 blur-[120px] -z-10" />
      
    </div>
  );
}
