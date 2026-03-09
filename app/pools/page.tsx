"use client";

import React, { useEffect, useState } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { ADDRESSES, POOL_KEYS, StateViewABI, PoolKeyKey, PoolManagerABI, PoolModifyLiquidityTestABI, MockERC20ABI } from "@/lib/constants";
import { computePoolId, getHumanReadablePrice, getPoolKeyOnly } from "@/lib/math";
import { Activity, TrendingUp, PlusCircle, PlayCircle, RefreshCw, Settings2 } from "lucide-react";

interface PoolData {
    id: string;
    label: string;
    symbol0: string;
    symbol1: string;
    price: string;
    tick: number | string;
    fee: number;
    isInitialized: boolean;
}

const AVAILABLE_TOKENS = [
    { symbol: "USDC", address: "0xfF4E6B5c3583adb51512E9f8e6C5808F50ec07bc" },
    { symbol: "NBL", address: "0xFf2B8F49B569c625eC2c271765dE2418b8506ACE" },
    { symbol: "SLR", address: "0x84F8df19803B636f27a3947fD4D0c1b51C166426" },
    { symbol: "ATH", address: "0xa446cCB04E2B78Eb2cfC5B3e6b5960f90C3fE124" },
    { symbol: "VTX", address: "0xE9364b7510bd60A76F26718cF307150466C71516" },
    { symbol: "ZTA", address: "0xff2eF9147391742aca9937cf0F39D63E0C18a668" }
];

type PredefinedOrCustom = "10" | "60" | "100" | "custom";
type FeeTierSel = "0.05" | "0.3" | "custom";
type RatioSel = "1:1" | "1:2" | "2:1" | "custom";

export default function PoolsPage() {
    const { isConnected, address } = useAccount();
    const [pools, setPools] = useState<PoolData[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Custom Initialization State
    const [initToken0, setInitToken0] = useState(AVAILABLE_TOKENS[1].address); // Default NBL
    const [initToken1, setInitToken1] = useState(AVAILABLE_TOKENS[0].address); // Default USDC
    const [tickSpacingSel, setTickSpacingSel] = useState<PredefinedOrCustom>("60");
    const [customTickSpacing, setCustomTickSpacing] = useState("200");
    const [feeTierSel, setFeeTierSel] = useState<FeeTierSel>("0.3");
    const [customFeeTier, setCustomFeeTier] = useState("0.4");
    const [ratioSel, setRatioSel] = useState<RatioSel>("1:1");
    const [customRatioA, setCustomRatioA] = useState("3");
    const [customRatioB, setCustomRatioB] = useState("1");
    const [liquidityModalPool, setLiquidityModalPool] = useState<PoolKeyKey | null>(null);
    const [liqAmount0, setLiqAmount0] = useState("");
    const [liqAmount1, setLiqAmount1] = useState("");

    const fetchPoolData = async () => {
        try {
            let provider;
            if (typeof window !== "undefined" && window.ethereum) {
                provider = new BrowserProvider(window.ethereum);
            } else {
                provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
            }
            const stateView = new Contract(ADDRESSES.StateView, StateViewABI, provider);

            const poolPromises = Object.entries(POOL_KEYS).map(async ([key, poolMeta]) => {

                const poolId = computePoolId(poolMeta);
                console.log({poolId});

                try {
                    const slot0 = await stateView.getSlot0(poolId);
                    console.log({slot0})
                    
                    const sqrtPriceX96 = slot0.sqrtPriceX96;
                    const tick = Number(slot0.tick);
                    
                    if (sqrtPriceX96 === BigInt(0)) {
                         throw new Error("Pool sqrtPrice is 0 (Uninitialized)");
                    }

                    const humanPrice = getHumanReadablePrice(
                        sqrtPriceX96, 
                        poolMeta.currency0Decimals, 
                        poolMeta.currency1Decimals
                    );

                    return {
                        id: key,
                        label: poolMeta.label as string,
                        symbol0: poolMeta.currency0Symbol as string,
                        symbol1: poolMeta.currency1Symbol as string,
                        price: humanPrice,
                        tick: tick,
                        fee: poolMeta.fee as number,
                        isInitialized: true
                    } as PoolData;
                } catch (err) {
                    console.warn(`Pool ${key} might not be initialized:`, err);
                    return {
                        id: key,
                        label: poolMeta.label as string,
                        symbol0: poolMeta.currency0Symbol as string,
                        symbol1: poolMeta.currency1Symbol as string,
                        price: "Uninitialized",
                        tick: "-",
                        fee: poolMeta.fee as number,
                        isInitialized: false
                    } as PoolData;
                }
            });

            const results = await Promise.all(poolPromises);
            console.log({results});
            setPools(results);
        } catch (error) {
            console.error("Error fetching pools:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPoolData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    // NEW Custom Pool Initialize
    const handleInitializeCustom = async () => {
        if (!isConnected || !address || !window.ethereum) {
            toast.error("Connect wallet first!");
            return;
        }

        if (initToken0 === initToken1) {
            toast.error("Token0 and Token1 must be different.");
            return;
        }

        try {
            setActionLoading("init-custom");
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const poolManager = new Contract(ADDRESSES.PoolManager, PoolManagerABI, signer);

            // Determine Tick Spacing
            const ts = tickSpacingSel === "custom" ? parseInt(customTickSpacing) : parseInt(tickSpacingSel);
            if (isNaN(ts) || ts <= 0) throw new Error("Invalid tick spacing");

            // Determine Fee Tier
            let fee = 3000;
            if (feeTierSel === "0.05") fee = 500;
            else if (feeTierSel === "0.3") fee = 3000;
            else {
                const customF = parseFloat(customFeeTier);
                if (isNaN(customF) || customF < 0) throw new Error("Invalid fee tier");
                fee = customF * 10000; // e.g. 0.4% -> 4000
            }

            // Determine Ratio
            let ratio = 1;
            if (ratioSel === "1:1") ratio = 1;
            else if (ratioSel === "1:2") ratio = 2; // price = 2 (1 T0 = 2 T1)
            else if (ratioSel === "2:1") ratio = 0.5;
            else {
                const rA = parseFloat(customRatioA);
                const rB = parseFloat(customRatioB);
                if (isNaN(rA) || isNaN(rB) || rA <= 0 || rB <= 0) throw new Error("Invalid custom ratio");
                ratio = rB / rA;
            }

            // Validate Ordering (Currency0 < Currency1)
            let t0 = initToken0;
            let t1 = initToken1;
            let finalRatio = ratio;

            if (BigInt(t0) > BigInt(t1)) {
                // Swap tokens to satisfy Uniswap V4 criteria
                t0 = initToken1;
                t1 = initToken0;
                finalRatio = 1 / ratio; // Invert ratio
            }

            const poolKey = getPoolKeyOnly({
                currency0: t0,
                currency1: t1,
                fee: Math.floor(fee),
                tickSpacing: ts,
                hooks: ADDRESSES.VeilBook // Hardcoded as requested
            });

            const sqrtPriceX96 = BigInt(Math.floor(Math.sqrt(finalRatio) * Math.pow(2, 96)));
            console.log({poolKey, sqrtPriceX96})
            const tx = await poolManager.initialize(poolKey, sqrtPriceX96);
            toast.info("Initializing Custom Pool...", { autoClose: false, toastId: "init-custom" });
            await tx.wait();
            
            toast.dismiss("init-custom");
            toast.success("Custom Pool Initialized Successfully!");
            
            // Refresh grid just in case predefined pool maps to this new one
            fetchPoolData();
        } catch (e: any) {
            console.error(e);
            toast.dismiss("init-custom");
            toast.error(e?.reason || e?.message || "Initialization failed");
        } finally {
            setActionLoading(null);
        }
    };

    // Sync function for Liquidity Provision
    const syncLiquidityAmounts = async (val: string, isToken0: boolean) => {
        if (!liquidityModalPool || !val || isNaN(Number(val))) return;
        
        try {
            const meta = POOL_KEYS[liquidityModalPool];
            let provider;
            if (typeof window !== "undefined" && window.ethereum) {
                provider = new BrowserProvider(window.ethereum);
            } else {
                provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
            }
            const stateView = new Contract(ADDRESSES.StateView, StateViewABI, provider);
            const slot0 = await stateView.getSlot0(computePoolId(meta));
            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);

            const Q96 = BigInt(2) ** BigInt(96);
            if (isToken0) {
                const amount0 = ethers.parseUnits(val, meta.currency0Decimals);
                // amount1 = amount0 * (sqrtPriceX96 / Q96)^2
                const amount1 = (amount0 * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
                setLiqAmount1(ethers.formatUnits(amount1, meta.currency1Decimals));
            } else {
                const amount1 = ethers.parseUnits(val, meta.currency1Decimals);
                // amount0 = amount1 / (sqrtPriceX96 / Q96)^2  => amount1 * Q96^2 / sqrtPriceX96^2
                const amount0 = (amount1 * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
                setLiqAmount0(ethers.formatUnits(amount0, meta.currency0Decimals));
            }
        } catch (e) {
            console.error("Sync error", e);
        }
    };

    const handleAddLiquidity = async () => {
         if (!liquidityModalPool) return;
         if (!isConnected || !address || !window.ethereum) {
              toast.error("Connect wallet first!");
              return;
         }

         if (!ADDRESSES.PoolModifyLiquidityTest) {
             toast.error("PoolModifyLiquidityTest address not configured. See lib/constants.ts");
             return;
         }

         try {
             setActionLoading(`add-${liquidityModalPool}`);
             
             const provider = new BrowserProvider(window.ethereum);
             const signer = await provider.getSigner();
             const router = new Contract(ADDRESSES.PoolModifyLiquidityTest, PoolModifyLiquidityTestABI, signer);
             const stateView = new Contract(ADDRESSES.StateView, StateViewABI, provider);

             const poolMeta = POOL_KEYS[liquidityModalPool];
             const poolKey = getPoolKeyOnly(poolMeta);
             const poolId = computePoolId(poolMeta);

             const slot0 = await stateView.getSlot0(poolId);
             const sqrtPriceX96 = slot0.sqrtPriceX96;

             const amount0 = ethers.parseUnits(liqAmount0, poolMeta.currency0Decimals);
             const amount1 = ethers.parseUnits(liqAmount1, poolMeta.currency1Decimals);

             const { getLiquidityDelta } = await import("@/lib/math");
             const liquidityDelta = getLiquidityDelta(
                 amount0,
                 amount1,
                 sqrtPriceX96,
                 -6000,
                 6000
             );

             const token0 = new Contract(poolMeta.currency0, MockERC20ABI, signer);
             const token1 = new Contract(poolMeta.currency1, MockERC20ABI, signer);

              const params = {
                 tickLower: -6000,
                 tickUpper: 6000,
                 liquidityDelta: liquidityDelta,
                 salt: ethers.ZeroHash
             };
             console.log({poolKey, params})

             toast.info("Approving tokens...", { autoClose: false, toastId: `approve-${liquidityModalPool}` });
             const approve0 = await token0.approve(ADDRESSES.PoolModifyLiquidityTest, amount0);
             await approve0.wait();
             const approve1 = await token1.approve(ADDRESSES.PoolModifyLiquidityTest, amount1);
             await approve1.wait();
             toast.dismiss(`approve-${liquidityModalPool}`);

            
             const tx = await router.modifyLiquidity(poolKey, params, "0x");
             toast.info("Adding Liquidity to Pool...", { autoClose: false, toastId: `add-${liquidityModalPool}` });
             await tx.wait();

             toast.dismiss(`add-${liquidityModalPool}`);
             toast.success("Liquidity Added!");
             setLiquidityModalPool(null);
             fetchPoolData();
         } catch (e: any) {
             console.error(e);
             toast.dismiss(`approve-${liquidityModalPool}`);
             toast.dismiss(`add-${liquidityModalPool}`);
             toast.error(e?.reason || e?.message || "Add liquidity failed");
         } finally {
             setActionLoading(null);
         }
    };

    const ToggleBtn = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                active 
                ? "bg-white/20 text-white border border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.15)]" 
                : "bg-black/40 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600"
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-5xl mx-auto py-10 space-y-12">
            
            <div className="space-y-4 text-center">
                <div className="inline-flex items-center justify-center rounded-full bg-white/10 p-4 text-white mb-2 border border-white/20">
                    <Activity className="h-8 w-8" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Active Pools</h1>
                <p className="text-zinc-400 max-w-lg mx-auto">
                    Real-time metrics for Uniswap V4 VeilBook pair pools on Sepolia.
                </p>
            </div>

            {/* Custom Pool Initialization Form */}
            <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-sm relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-white/10 rounded-lg border border-white/20">
                        <Settings2 className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Initialize Custom Pool</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10 w-full">
                    
                    {/* Tokens */}
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Token 0</label>
                        <select 
                            value={initToken0} 
                            onChange={e=>setInitToken0(e.target.value)}
                            className="w-full bg-black/60 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-white/50 appearance-none font-medium"
                        >
                            {AVAILABLE_TOKENS.map(t => <option key={`t0-${t.symbol}`} value={t.address}>{t.symbol}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Token 1</label>
                        <select 
                            value={initToken1} 
                            onChange={e=>setInitToken1(e.target.value)}
                            className="w-full bg-black/60 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-white/50 appearance-none font-medium"
                        >
                            {AVAILABLE_TOKENS.map(t => <option key={`t1-${t.symbol}`} value={t.address}>{t.symbol}</option>)}
                        </select>
                    </div>

                    {/* Tick Spacing */}
                    <div className="space-y-3 col-span-1 md:col-span-2 bg-black/20 p-4 rounded-2xl border border-zinc-900/50">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Tick Spacing</label>
                        <div className="flex flex-wrap items-center gap-2 w-full">
                            <ToggleBtn label="10" active={tickSpacingSel === "10"} onClick={() => setTickSpacingSel("10")} />
                            <ToggleBtn label="60" active={tickSpacingSel === "60"} onClick={() => setTickSpacingSel("60")} />
                            <ToggleBtn label="100" active={tickSpacingSel === "100"} onClick={() => setTickSpacingSel("100")} />
                            <ToggleBtn label="Custom" active={tickSpacingSel === "custom"} onClick={() => setTickSpacingSel("custom")} />
                            {tickSpacingSel === "custom" && (
                                <input 
                                    type="number"
                                    value={customTickSpacing}
                                    onChange={(e) => setCustomTickSpacing(e.target.value)}
                                    placeholder="200"
                                    className="bg-black/60 border border-zinc-800 text-white px-3 py-2 rounded-xl focus:outline-none focus:border-white/50 w-24 text-sm"
                                />
                            )}
                        </div>
                    </div>

                    {/* Fee Tier */}
                    <div className="space-y-3 col-span-1 md:col-span-2 bg-black/20 p-4 rounded-2xl border border-zinc-900/50">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Fee Tier (%)</label>
                        <div className="flex flex-wrap items-center gap-2 w-full">
                            <ToggleBtn label="0.05%" active={feeTierSel === "0.05"} onClick={() => setFeeTierSel("0.05")} />
                            <ToggleBtn label="0.3%" active={feeTierSel === "0.3"} onClick={() => setFeeTierSel("0.3")} />
                            <ToggleBtn label="Custom" active={feeTierSel === "custom"} onClick={() => setFeeTierSel("custom")} />
                            {feeTierSel === "custom" && (
                                <input 
                                    type="number"
                                    step="0.1"
                                    value={customFeeTier}
                                    onChange={(e) => setCustomFeeTier(e.target.value)}
                                    placeholder="0.4"
                                    className="bg-black/60 border border-zinc-800 text-white px-3 py-2 rounded-xl focus:outline-none focus:border-white/50 w-24 text-sm"
                                />
                            )}
                        </div>
                    </div>

                    {/* SqrtPriceX96 (Ratio) */}
                    <div className="space-y-3 col-span-1 md:col-span-2 bg-black/20 p-4 rounded-2xl border border-zinc-900/50">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Starting Ratio (Token0 : Token1)</label>
                        <div className="flex flex-wrap items-center gap-2 w-full">
                            <ToggleBtn label="1:1" active={ratioSel === "1:1"} onClick={() => setRatioSel("1:1")} />
                            <ToggleBtn label="1:2" active={ratioSel === "1:2"} onClick={() => setRatioSel("1:2")} />
                            <ToggleBtn label="2:1" active={ratioSel === "2:1"} onClick={() => setRatioSel("2:1")} />
                            <ToggleBtn label="Custom" active={ratioSel === "custom"} onClick={() => setRatioSel("custom")} />
                            {ratioSel === "custom" && (
                                <div className="flex items-center gap-3 ml-2">
                                    <input 
                                        type="number"
                                        value={customRatioA}
                                        onChange={(e) => setCustomRatioA(e.target.value)}
                                        placeholder="3"
                                        className="bg-black/60 border border-zinc-800 text-white px-3 py-2 rounded-xl focus:outline-none focus:border-white/50 w-16 text-center text-sm"
                                    />
                                    <span className="text-zinc-500 font-bold">:</span>
                                    <input 
                                        type="number"
                                        value={customRatioB}
                                        onChange={(e) => setCustomRatioB(e.target.value)}
                                        placeholder="1"
                                        className="bg-black/60 border border-zinc-800 text-white px-3 py-2 rounded-xl focus:outline-none focus:border-white/50 w-16 text-center text-sm"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hardcoded Hook */}
                    <div className="space-y-2 col-span-1 md:col-span-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider font-bold flex justify-between w-full">
                            <span>Hook Address</span>
                        </label>
                        <input 
                            disabled
                            value={ADDRESSES.VeilBook}
                            className="w-full bg-black/30 border border-zinc-800/50 text-zinc-500 px-4 py-3 rounded-xl cursor-not-allowed font-mono text-sm"
                        />
                    </div>
                </div>
                
                <button 
                    onClick={handleInitializeCustom}
                    disabled={actionLoading !== null}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-bold rounded-2xl transition-all disabled:opacity-50 text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] mt-8"
                >
                    {actionLoading === "init-custom" ? <RefreshCw className="h-5 w-5 animate-spin"/> : <div></div>}
                    Initialize Pool
                </button>
            </div>

            {/* Displaying Known Pools below */}
            {loading ? (
                <div className="flex items-center justify-center py-20 w-full">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                </div>
            ) : pools.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 bg-zinc-900/40 rounded-3xl w-full border border-zinc-800 mx-4">
                    <p>No pool data available.</p>
                </div>
            ) : (
                <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {pools.map((pool) => (
                        <div
                            key={pool.id}
                            className="group flex flex-col pt-6 bg-zinc-900/40 border border-zinc-800 rounded-3xl backdrop-blur-sm transition-all hover:border-white/50 hover:bg-zinc-900/80 w-full overflow-hidden"
                        >
                            <div className="px-6 pb-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="space-y-1 flex items-center gap-3">
                                        <h3 className="text-2xl font-bold text-white group-hover:text-white transition-colors">
                                            {pool.label}
                                        </h3>
                                        {!pool.isInitialized && (
                                            <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded text-red-500 border border-red-500/30 bg-red-500/10">Uninitialized</span>
                                        )}
                                    </div>
                                    <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                                        <TrendingUp className="h-5 w-5 text-zinc-400 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-zinc-500 mb-6">
                                    Fee Tier: {(pool.fee / 10000).toFixed(2)}% | TickSpacing: 60
                                </p>

                                <div className="grid grid-cols-2 gap-4 mt-auto">
                                    <div className="flex flex-col space-y-1 bg-black/40 rounded-xl p-4 border border-zinc-900 shadow-inner">
                                        <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Current Price</span>
                                        <span className="text-lg font-mono text-zinc-200">
                                            {pool.price} <span className="text-sm text-zinc-500">{pool.symbol1}</span>
                                        </span>
                                    </div>

                                    <div className="flex flex-col space-y-1 bg-black/40 rounded-xl p-4 border border-zinc-900 shadow-inner">
                                        <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Current Tick</span>
                                        <span className="text-lg font-mono text-zinc-200">
                                            {pool.tick}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Actions Footer */}
                            <div className="w-full bg-zinc-800/20 border-t border-zinc-800/80 p-4 flex gap-3">
                                {!pool.isInitialized ? (
                                    <span className="w-full flex items-center justify-center gap-2 py-3 text-zinc-500 justify-center font-medium rounded-xl border border-zinc-800/50 bg-black/20 text-sm">
                                        Use Custom Initialize
                                    </span>
                                ) : (
                                    <button 
                                        onClick={() => {
                                            setLiquidityModalPool(pool.id as PoolKeyKey);
                                            setLiqAmount0("");
                                            setLiqAmount1("");
                                        }}
                                        disabled={actionLoading !== null}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500 border border-emerald-500/20 text-emerald-500 justify-center hover:text-black font-bold rounded-xl transition-all disabled:opacity-50"
                                    >
                                        <PlusCircle className="h-4 w-4" />
                                        Add Liquidity
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Liquidity Modal */}
            {liquidityModalPool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-8 shadow-2xl relative">
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white">Add Liquidity</h2>
                            <button 
                                onClick={() => setLiquidityModalPool(null)}
                                className="text-zinc-500 hover:text-white"
                            >
                                <Activity className="h-6 w-6 rotate-45" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-white">{POOL_KEYS[liquidityModalPool].currency0Symbol}</span>
                                    <input 
                                        type="number"
                                        value={liqAmount0}
                                        onChange={(e) => {
                                            setLiqAmount0(e.target.value);
                                            syncLiquidityAmounts(e.target.value, true);
                                        }}
                                        placeholder="0.00"
                                        className="bg-transparent text-right text-xl font-mono text-white focus:outline-none w-1/2"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-center -my-3 relative z-10">
                                <div className="bg-zinc-800 p-2 rounded-full border border-zinc-700">
                                    <PlusCircle className="h-5 w-5 text-zinc-500" />
                                </div>
                            </div>

                            <div className="p-4 bg-black/40 rounded-2xl border border-zinc-800 space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-white">{POOL_KEYS[liquidityModalPool].currency1Symbol}</span>
                                    <input 
                                        type="number"
                                        value={liqAmount1}
                                        onChange={(e) => {
                                            setLiqAmount1(e.target.value);
                                            syncLiquidityAmounts(e.target.value, false);
                                        }}
                                        placeholder="0.00"
                                        className="bg-transparent text-right text-xl font-mono text-white focus:outline-none w-1/2"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2">
                             <div className="flex justify-between text-xs">
                                 {/* <span className="text-zinc-500 uppercase font-bold">Range</span>
                                 <span className="text-white font-mono">[-6000, 6000]</span> */}
                             </div>
                             <div className="flex justify-between text-xs">
                                 <span className="text-zinc-500 uppercase font-bold">Current Price</span>
                                 <span className="text-white font-mono">{pools.find(p=>p.id === liquidityModalPool)?.price} USDC</span>
                             </div>
                        </div>

                        <button 
                            onClick={handleAddLiquidity}
                            disabled={actionLoading !== null || !liqAmount0 || !liqAmount1}
                            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all disabled:opacity-50 text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        >
                            {actionLoading === `add-${liquidityModalPool}` ? <RefreshCw className="h-5 w-5 animate-spin mx-auto"/> : "Confirm Liquidity Provision"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
