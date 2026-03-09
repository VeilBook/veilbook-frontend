import { ArrowDownUp } from "lucide-react";
import React, { useState } from "react";
import { ADDRESSES, POOL_KEYS, PoolKeyKey, PoolSwapTestABI, MockERC20ABI, StateViewABI } from "@/lib/constants";
import { BrowserProvider, Contract, ethers } from "ethers";
import { computePoolId } from "@/lib/math";
import { toast } from "react-toastify";
import { useAccount } from "wagmi";

interface SwapSectionProps {
    selectedPool: PoolKeyKey;
    setSelectedPool: (pool: PoolKeyKey) => void;
    zeroForOne: boolean;
    setZeroForOne: (val: boolean) => void;
}

export function SwapSection({ selectedPool, setSelectedPool, zeroForOne, setZeroForOne }: SwapSectionProps) {
    const { address, isConnected } = useAccount();
    const poolMeta = POOL_KEYS[selectedPool];
    
    const inputSymbol = zeroForOne ? poolMeta.currency0Symbol : poolMeta.currency1Symbol;
    const outputSymbol = zeroForOne ? poolMeta.currency1Symbol : poolMeta.currency0Symbol;

    const [amountIn, setAmountIn] = useState("");
    const [amountOut, setAmountOut] = useState("");
    const [loading, setLoading] = useState(false);

    // Sync function for Swap
    const syncSwapAmounts = async (val: string, reverse: boolean = false) => {
        if (!val || isNaN(Number(val))) {
            setAmountOut("");
            return;
        }

        try {
            let provider;
            if (typeof window !== "undefined" && window.ethereum) {
                provider = new BrowserProvider(window.ethereum);
            } else {
                provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org");
            }
            const stateView = new Contract(ADDRESSES.StateView, StateViewABI, provider);
            const slot0 = await stateView.getSlot0(computePoolId(poolMeta));
            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96);
            const Q96 = BigInt(2) ** BigInt(96);

            if (zeroForOne) {
                // Token 0 -> Token 1
                const a0 = ethers.parseUnits(val, poolMeta.currency0Decimals);
                const a1 = (a0 * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
                setAmountOut(ethers.formatUnits(a1, poolMeta.currency1Decimals));
            } else {
                // Token 1 -> Token 0
                const a1 = ethers.parseUnits(val, poolMeta.currency1Decimals);
                const a0 = (a1 * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
                setAmountOut(ethers.formatUnits(a0, poolMeta.currency0Decimals));
            }
        } catch (e) {
            console.error("Swap sync error", e);
        }
    };

    // Trigger sync when relevant state changes
    React.useEffect(() => {
        syncSwapAmounts(amountIn);
    }, [amountIn, zeroForOne, selectedPool]);

    // Assuming user's Sepolia PoolSwapTest router address here or letting it fail cleanly if missing
    // We will use ADDRESSES.PoolSwapTest later but fall back if it is undefined. See lib/constants.ts for placeholder.
    
    const handleSwap = async () => {
        if (!window.ethereum || !address) {
            toast.error("Connect Wallet first.");
            return;
        }

        if (!ADDRESSES.PoolSwapTest) {
            toast.error("Standard Swaps are temporarily disabled (Router Address Missing). Please use Confidential Orders instead.");
            return;
        }

        if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
            toast.error("Enter a valid amount.");
            return;
        }

        try {
            setLoading(true);
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // Setup keys & params
            const poolKey = {
                currency0: poolMeta.currency0,
                currency1: poolMeta.currency1,
                fee: poolMeta.fee,
                tickSpacing: poolMeta.tickSpacing,
                hooks: poolMeta.hooks
            };
            
            // Amount adjusted by decimals
            const inputDecimals = zeroForOne ? poolMeta.currency0Decimals : poolMeta.currency1Decimals;
            const parsedAmount = ethers.parseUnits(amountIn, inputDecimals);

            // 1. Approve Token to Router
            const depositCurrency = zeroForOne ? poolMeta.currency0 : poolMeta.currency1;
            const tokenContract = new Contract(depositCurrency, MockERC20ABI, signer);
            const approveTx = await tokenContract.approve(ADDRESSES.PoolSwapTest, parsedAmount);
            toast.info("Approving swap router...", { autoClose: false, toastId: 'approve' });
            await approveTx.wait();
            toast.dismiss('approve');

            // 2. Perform Swap via Router
            const routerContract = new Contract(ADDRESSES.PoolSwapTest, PoolSwapTestABI, signer);
            
            const params = {
                zeroForOne,
                amountSpecified: -parsedAmount,
                // Usually MIN_SQRT_PRICE+1 for zeroForOne=true, Max-1 for zeroForOne=false
                // Using slippage protection bounds:
                sqrtPriceLimitX96: zeroForOne 
                    ? BigInt("4295128740") // MIN_SQRT_RATIO + 1
                    : BigInt("1461446703485210103287273052203988822378723970340") // MAX_SQRT_RATIO - 1
            };

            const testSettings = {
                takeClaims: false,
                settleUsingBurn: false
            };
            console.log({poolKey, params})

            const swapTx = await routerContract.swap(
                poolKey,
                params,
                testSettings,
                "0x",
                { value: 0 } // No ETH value
            );

            toast.info("Executing standard swap...", { autoClose: false, toastId: 'swap' });
            await swapTx.wait();

            toast.dismiss('swap');
            toast.success("Standard Swap successful!");
            setAmountIn("");
        } catch (error: any) {
            console.error("Swap Error:", error);
            toast.dismiss('approve');
            toast.dismiss('swap');
            toast.error(error.reason || error.message || "Swap failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-2xl relative overflow-hidden mb-8">
            <h2 className="text-xl font-bold tracking-tight text-white mb-6">Swap</h2>

            <div className="space-y-2 relative z-10">
                {/* Pool Selector Header */}
                <div className="flex justify-between items-center mb-4">
                    <label className="text-xs uppercase tracking-wider text-zinc-500 font-bold ml-1">Market</label>
                    <select 
                        value={selectedPool}
                        onChange={(e) => setSelectedPool(e.target.value as PoolKeyKey)}
                        className="bg-black/60 border border-zinc-800 text-white px-3 py-1.5 rounded-lg focus:outline-none focus:border-white/50 appearance-none text-sm transition-colors"
                    >
                        {Object.entries(POOL_KEYS).map(([key, meta]) => (
                            <option key={key} value={key}>{meta.label}</option>
                        ))}
                    </select>
                </div>

                {/* Input Card */}
                <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 transition-colors hover:border-zinc-700">
                    <label className="text-xs text-zinc-500 font-medium">You pay</label>
                    <div className="flex justify-between items-center mt-2 gap-4">
                        <input 
                            type="number"
                            value={amountIn}
                            onChange={(e) => {
                                setAmountIn(e.target.value);
                            }}
                            placeholder="0"
                            className="w-full bg-transparent text-white text-3xl font-mono focus:outline-none placeholder:text-zinc-600"
                        />
                        <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl transition-colors font-medium text-white border border-zinc-700 whitespace-nowrap">
                            {inputSymbol}
                        </button>
                    </div>
                </div>

                {/* Swap Flip Button */}
                <div className="relative h-2 flex items-center justify-center z-20">
                    <button 
                        onClick={() => setZeroForOne(!zeroForOne)}
                        className="absolute bg-zinc-900 border-4 border-[#1c1c1e] p-2 rounded-xl hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
                        style={{ backgroundColor: '#131313' }} // Match outer bg to simulate cutout
                    >
                        <ArrowDownUp className="h-4 w-4" />
                    </button>
                </div>

                {/* Output Card */}
                <div className="bg-black/40 border border-zinc-800 rounded-2xl p-4 transition-colors hover:border-zinc-700">
                    <label className="text-xs text-zinc-500 font-medium">You receive</label>
                    <div className="flex justify-between items-center mt-2 gap-4">
                        <input 
                            type="number"
                            disabled
                            value={amountOut}
                            placeholder="0"
                            className="w-full bg-transparent text-white text-3xl font-mono focus:outline-none placeholder:text-zinc-600 opacity-70"
                        />
                        <button className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-xl transition-colors font-medium text-white border border-zinc-700 whitespace-nowrap">
                            {outputSymbol}
                        </button>
                    </div>
                </div>

                <button 
                    onClick={handleSwap}
                    disabled={loading}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-4 px-4 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/20 hover:shadow-white/40"
                >
                    {loading ? "Swapping..." : "Standard Swap"}
                </button>
                <p className="text-center text-[10px] text-zinc-500 mt-2 font-medium">Standard swaps update the pool. Confidential Orders below conceal your intent.</p>
            </div>
        </div>
    );
}
