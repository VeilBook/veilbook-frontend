"use client";

import React, { useState, useEffect } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { ADDRESSES, POOL_KEYS, VeilBookABI, PoolKeyKey, EncryptedERC20ABI, StateViewABI } from "@/lib/constants";
import { computePoolId, getHumanReadablePrice } from "@/lib/math";
import { useFhe } from "@/components/FheProvider";
import { RefreshCw, Lock, AlertCircle, TrendingUp, TrendingDown, Activity } from "lucide-react";

import { SwapSection } from "./SwapSection";

export default function TradePage() {
    const { address, isConnected } = useAccount();
    const fhe = useFhe();
    const [selectedPool, setSelectedPool] = useState<PoolKeyKey>("NBL_USDC");
    const [zeroForOne, setZeroForOne] = useState<boolean>(true); // true = sell token for USDC, false = buy token with USDC
    const [tickContent, setTickContent] = useState<string>("");
    const [amountContent, setAmountContent] = useState<string>("");
    const [placingOrder, setPlacingOrder] = useState<boolean>(false);

    const poolMeta = POOL_KEYS[selectedPool];

    // Selling symbol
    const inputSymbol = zeroForOne ? poolMeta.currency0Symbol : poolMeta.currency1Symbol;
    const inputDecimals = zeroForOne ? poolMeta.currency0Decimals : poolMeta.currency1Decimals;

    // Buying Symbol
    const outputSymbol = zeroForOne ? poolMeta.currency1Symbol : poolMeta.currency0Symbol;

    // Analytics state
    const [poolPrice, setPoolPrice] = useState<string>("...");
    const [poolTick, setPoolTick] = useState<number | string>("...");

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                let provider;
                if (typeof window !== "undefined" && window.ethereum) {
                    provider = new BrowserProvider(window.ethereum);
                } else {
                    provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
                }
                const stateView = new Contract(ADDRESSES.StateView, StateViewABI, provider);
                const pId = computePoolId(poolMeta);
                const slot0 = await stateView.getSlot0(pId);
                setPoolTick(Number(slot0.tick));
                setPoolPrice(getHumanReadablePrice(slot0.sqrtPriceX96, poolMeta.currency0Decimals, poolMeta.currency1Decimals));
            } catch (err) {
                console.error("Failed to fetch analytics", err);
                setPoolPrice("Off");
                setPoolTick("Off");
            }
        };
        fetchAnalytics();
    }, [selectedPool, poolMeta]);

    const handlePlaceOrder = async () => {
        if (!isConnected || !address || !window.ethereum) {
            toast.error("Please connect your wallet first");
            return;
        }

        if (!fhe) {
            toast.error("Zama FHE network not initialized properly");
            return;
        }

        const inputTick = Number(tickContent);
        if (isNaN(inputTick) || inputTick % 60 !== 0) {
            toast.error("Tick must be a multiple of 60 (e.g. 60, 120, -60)");
            return;
        }

        const amount = Number(amountContent);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        try {
            setPlacingOrder(true);
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const veilBook = new Contract(ADDRESSES.VeilBook, VeilBookABI, signer);

            // Compute depositCurrency based on direction
            const depositCurrency = zeroForOne ? poolMeta.currency0 : poolMeta.currency1;
            const parsedAmount = ethers.parseUnits(amount.toString(), inputDecimals);

            // 1. Fetch Encrypted Token address for approval
            toast.info("Approving Zama encrypted operator...", { autoClose: 2000 });
            const poolId = computePoolId(poolMeta);
            const encTokenAddr = await veilBook.getEncryptedToken(poolId, depositCurrency);

            const encTokenContract = new Contract(encTokenAddr, EncryptedERC20ABI, signer);
            const until = Math.floor(Date.now() / 1000) + 3600; // valid for 1 hour

            const approveTx = await encTokenContract.setOperator(ADDRESSES.VeilBook, until);
            await approveTx.wait();

            // 2. Encrypt input amount using Zama SDK
            toast.info("Encrypting order amount privately...", { autoClose: 2000 });
            const encryptedInput = await fhe.createEncryptedInput(ADDRESSES.VeilBook, address)
                .add64(parsedAmount)
                .encrypt();

            // 3. Place Order
            toast.info("Submitting order to network...", { autoClose: 3000 });
            const tx = await veilBook.placeOrder(
                getPoolKeyOnly(poolMeta),
                inputTick,
                zeroForOne,
                encryptedInput.handles[0],
                encryptedInput.inputProof
            );

            await tx.wait();
            toast.success("Order placed successfully! Confidential amount hidden from mempool.");

            // reset
            setAmountContent("");
        } catch (error: any) {
            console.error("Order error:", error);
            toast.error(error?.reason || error?.message || "Failed to place order");
        } finally {
            setPlacingOrder(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-lg mx-auto py-10">
            <SwapSection
                selectedPool={selectedPool}
                setSelectedPool={setSelectedPool}
                zeroForOne={zeroForOne}
                setZeroForOne={setZeroForOne}
            />

            {/* Analytics Header */}
            <div className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex justify-between items-center mb-6 shadow-md mt-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-lg text-white">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Market Price</span>
                        <span className="text-white font-mono text-sm">{poolPrice} <span className="text-zinc-500 text-xs">{poolMeta.currency1Symbol}</span></span>
                    </div>
                </div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Current Tick</span>
                    <span className="text-white font-mono text-sm">{poolTick}</span>
                </div>
            </div>

            <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl relative overflow-hidden">
                {/* Decorative glow inside the form */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <h1 className="text-2xl font-bold tracking-tight text-white mb-8 flex items-center gap-2">
                    <Lock className="h-5 w-5 text-white" />
                    Place Confidential Order
                </h1>

                <div className="space-y-6 relative z-10">
                    {/* Pool/Direction hidden because they are controlled by the Swap card */}
                    {/* Direction Toggle */}
                    <div className="grid grid-cols-2 gap-3 p-1 bg-black/40 border border-zinc-800 rounded-xl">
                        <button
                            onClick={() => setZeroForOne(true)}
                            className={`flex justify-center items-center gap-2 p-3 font-semibold rounded-lg transition-all ${zeroForOne ? 'bg-zinc-800 text-red-400 shadow-sm border border-red-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
                        >
                            <TrendingDown className="h-4 w-4" />
                            Sell {poolMeta.currency0Symbol}
                        </button>
                        <button
                            onClick={() => setZeroForOne(false)}
                            className={`flex justify-center items-center gap-2 p-3 font-semibold rounded-lg transition-all ${!zeroForOne ? 'bg-zinc-800 text-green-400 shadow-sm border border-green-500/20' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
                        >
                            <TrendingUp className="h-4 w-4" />
                            Buy {poolMeta.currency0Symbol}
                        </button>
                    </div>

                    {/* Tick Input */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold ml-1">Limit Tick</label>
                            <span className="text-[10px] text-zinc-600 font-mono">Mult. of 60</span>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={tickContent}
                                onChange={(e) => setTickContent(e.target.value)}
                                placeholder="60"
                                className="w-full bg-black/60 border border-zinc-800 text-white p-4 rounded-xl focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-colors font-mono text-lg"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-mono">TICK</div>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold ml-1">Amount</label>
                            <div className="flex gap-1 items-center bg-white/10 border border-white/20 px-2 pl-1.5 py-0.5 rounded text-[10px] font-medium text-white">
                                <Lock className="h-3 w-3" /> FHE Encrypted
                            </div>
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                value={amountContent}
                                onChange={(e) => setAmountContent(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-black/60 border border-zinc-800 text-white p-4 rounded-xl focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-colors font-mono text-2xl"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <span className="font-semibold text-zinc-300 bg-zinc-800 px-3 py-1 rounded-md text-sm border border-zinc-700">
                                    {inputSymbol}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Expected output direction helper */}
                    <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 p-4 rounded-xl text-sm text-zinc-400">
                        <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <p>You are swapping <span className="text-blue-400 font-semibold">{inputSymbol}</span> for <span className="text-blue-400 font-semibold">{outputSymbol}</span>. Only the exact limit tick will execute.</p>
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handlePlaceOrder}
                        disabled={placingOrder || !isConnected}
                        className="w-full mt-4 flex items-center justify-center gap-2 py-4 px-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/20 hover:shadow-white/40"
                    >
                        {placingOrder ? (
                            <>
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                Processing Order...
                            </>
                        ) : (
                            "Place Confidential Order"
                        )}
                    </button>

                    {!isConnected && (
                        <p className="text-center text-xs text-red-400 font-medium">
                            Wallet connection required
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
