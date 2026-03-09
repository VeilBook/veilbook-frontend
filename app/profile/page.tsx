"use client";

import React, { useState, useEffect } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { useAccount } from "wagmi";
import { toast } from "react-toastify";
import { ADDRESSES, VeilBookABI } from "@/lib/constants";
import { useFhe } from "@/components/FheProvider";
import { ListChecks, XCircle, DownloadCloud, Unlock, Lock } from "lucide-react";

interface OrderData {
    orderId: string;
    tick: number;
    zeroForOne: boolean;
    active: boolean;
    amountIn: bigint;
    amountOut: bigint;
    filledIn: any;
    filledOut: any;
    timestamp: number;
}

export default function OrdersPage() {
    const { address, isConnected } = useAccount();
    const fhe = useFhe();
    const [loading, setLoading] = useState<boolean>(true);
    const [orders, setOrders] = useState<OrderData[]>([]);
    const [decryptedValues, setDecryptedValues] = useState<Record<string, { filledIn?: number, filledOut?: number }>>({});
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchOrders = async () => {
        if (!isConnected || !address || !window.ethereum) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const provider = new BrowserProvider(window.ethereum);
            const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, provider);

            // use getUserOrders — no event filtering, no block range issues
            const orderIds: string[] = await contract.getUserOrders(address);

            if (orderIds.length === 0) {
                setOrders([]);
                return;
            }

            const orderPromises = orderIds.map(async (id: string) => {
                const data = await contract.getOrder(id);
                return {
                    orderId: id,
                    tick: Number(data.tick),
                    zeroForOne: data.zeroForOne,
                    active: data.active,
                    amountIn: data.amountIn,
                    amountOut: data.amountOut,
                    filledIn: data.filledIn,
                    filledOut: data.filledOut,
                    timestamp: Date.now(),
                } as OrderData;
            });

            const results = await Promise.all(orderPromises);
            setOrders(results);
        } catch (error) {
            console.error("Error fetching orders:", error);
            toast.error("Failed to fetch orders");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchOrders();
        } else {
            setOrders([]);
            setLoading(false);
        }
    }, [isConnected, address]);

    const decryptOrderAmounts = async (order: OrderData) => {
        if (!fhe || !address || !window.ethereum) return;

        try {
            setActionLoading(`decrypt-${order.orderId}`);
            toast.info("Signing decryption request...");

            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // const filledInHandle = order.filledIn;
            // const filledOutHandle = order.filledOut;

            const filledInHandle = "0x" + BigInt(order.filledIn).toString(16).padStart(64, "0");
const filledOutHandle = "0x" + BigInt(order.filledOut).toString(16).padStart(64, "0");

            console.log("filledInHandle:", filledInHandle);
            console.log("filledOutHandle:", filledOutHandle);
            let valIn = BigInt(0);
            let valOut = BigInt(0);

            const handleContractPairs = [
                { handle: filledInHandle, contractAddress: ADDRESSES.VeilBook },
                { handle: filledOutHandle, contractAddress: ADDRESSES.VeilBook },
            ];

            console.log("handleContractPairs:", handleContractPairs);

            const keypair = fhe.generateKeypair();
            const startTimeStamp = Math.floor(Date.now() / 1000).toString();
            const durationDays = "1";
            const contractAddresses = [ADDRESSES.VeilBook];

            const eip712 = fhe.createEIP712(
                keypair.publicKey,
                contractAddresses,
                startTimeStamp,
                durationDays
            );

            const signature = await signer.signTypedData(
                eip712.domain,
                { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
                eip712.message,
            );

            toast.info("Waiting for Relayer decryption response...");
            const result = await fhe.userDecrypt(
                handleContractPairs,
                keypair.privateKey,
                keypair.publicKey,
                signature.replace("0x", ""),
                contractAddresses,
                signer.address,
                startTimeStamp,
                durationDays,
            );

            console.log("decrypt result:", result);

            // use handle directly as key — same pattern as working sample code

      
            valIn = result[filledInHandle] as bigint;
            valIn = BigInt(result[filledInHandle]);
            valOut = result[filledOutHandle] as bigint;
            valOut = BigInt(result[filledOutHandle]);
            console.log("valIn:", valIn);
            console.log("valOut:", valOut);

            setDecryptedValues(prev => ({
                ...prev,
                [order.orderId]: { 
                    filledIn: Number(valIn), 
                    filledOut: Number(valOut) 
                }
            }));

            toast.success("Successfully decrypted filled amounts!");
        } catch (error: any) {
            console.error("Decryption failed:", error);
            toast.error(error?.reason || error?.message || "Decryption failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleCancel = async (order: OrderData) => {
        if (!window.ethereum) return;

        const decrypted = decryptedValues[order.orderId];
        if (!decrypted || decrypted.filledIn === undefined) {
            toast.error("Please decrypt the order first!");
            return;
        }

        try {
            setActionLoading(`cancel-${order.orderId}`);
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, signer);

            const assumedOriginalAmount = prompt(
                `You have ${decrypted.filledIn} filled so far.\nWhat was your original total deposit amount?\n(Enter raw integer, e.g. 1000000 for 1 token with 6 decimals)`
            );

            if (!assumedOriginalAmount) {
                toast.info("Cancellation aborted.");
                setActionLoading(null);
                return;
            }

            const totalInNumber = Number(assumedOriginalAmount);
            const unfilled = totalInNumber - decrypted.filledIn;

            if (unfilled < 0) {
                toast.error("Unfilled amount cannot be negative");
                return;
            }

            const tx = await contract.cancelOrder(order.orderId, unfilled);
            toast.info("Canceling order...", { autoClose: false, toastId: 'canceling' });
            await tx.wait();
            toast.dismiss('canceling');
            toast.success("Order cancelled successfully!");
            await fetchOrders();
        } catch (error: any) {
            console.error("Cancel failed:", error);
            toast.dismiss('canceling');
            toast.error(error?.reason || error?.message || "Cancel failed");
        } finally {
            setActionLoading(null);
        }
    };

    const handleClaim = async (order: OrderData) => {
        if (!window.ethereum) return;

        const decrypted = decryptedValues[order.orderId];
        if (!decrypted || decrypted.filledOut === undefined) {
            toast.error("Please decrypt the order first!");
            return;
        }

        try {
            setActionLoading(`claim-${order.orderId}`);
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, signer);

            const tx = await contract.claimFill(order.orderId, decrypted.filledOut);
            toast.info("Claiming filled tokens...", { autoClose: false, toastId: 'claiming' });
            await tx.wait();
            toast.dismiss('claiming');
            toast.success("Tokens claimed successfully!");
            await fetchOrders();
        } catch (error: any) {
            console.error("Claim failed:", error);
            toast.dismiss('claiming');
            toast.error(error?.reason || error?.message || "Claim failed");
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-6xl mx-auto py-10 space-y-12">

            <div className="space-y-4 text-center">
                <div className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 p-4 text-emerald-500 mb-2 border border-emerald-500/20">
                    <ListChecks className="h-8 w-8" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Your Orders</h1>
                <p className="text-zinc-400 max-w-lg mx-auto">
                    Manage your active limit orders, decrypt filled balances confidentially, and claim settlements.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
                </div>
            ) : !isConnected ? (
                <div className="text-center py-10 px-6 rounded-2xl w-full max-w-lg bg-white/10 border border-white/30 text-white">
                    <p className="font-semibold">Connect Wallet to view your orders.</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="text-center py-20 text-zinc-500 bg-zinc-900/40 rounded-2xl w-full border border-zinc-800">
                    <p>No orders found. Head to the Trade tab to place your first limit order.</p>
                </div>
            ) : (
                <div className="w-full flex flex-col space-y-4">
                    <h2 className="text-xl font-bold text-white">Your Limits</h2>
                    {orders.map((order) => {
                        const isDecrypted = decryptedValues[order.orderId] !== undefined;
                        const dec = decryptedValues[order.orderId];
                        const isActionDisabled = actionLoading !== null;

                        return (
                            <div
                                key={order.orderId}
                                className={`flex flex-col md:flex-row items-center justify-between p-6 bg-zinc-900/60 border rounded-2xl transition-all w-full
                                    ${order.active ? 'border-zinc-700 hover:border-emerald-500/50' : 'border-red-900/30 opacity-70'}
                                `}
                            >
                                {/* Left Side */}
                                <div className="flex flex-col space-y-2 w-full md:w-1/3 mb-6 md:mb-0">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md border
                                            ${order.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}
                                        `}>
                                            {order.active ? 'Active' : 'Closed'}
                                        </span>
                                        <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md border
                                            ${order.zeroForOne ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
                                        `}>
                                            {order.zeroForOne ? 'SELL' : 'BUY'}
                                        </span>
                                    </div>
                                    <div className="font-mono text-xs text-zinc-500 mt-2 break-all bg-black/50 p-2 rounded-lg border border-zinc-900">
                                        ID: {order.orderId}
                                    </div>
                                    <p className="text-white font-semibold flex items-center gap-2 mt-2">
                                        Tick: <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-white">{order.tick}</span>
                                    </p>
                                </div>

                                {/* Center Balances */}
                                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-1/3 items-center justify-center mb-6 md:mb-0">
                                    <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl w-full text-center">
                                        <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Filled In</div>
                                        {isDecrypted ? (
                                            <div className="font-mono text-white text-lg">{dec?.filledIn}</div>
                                        ) : (
                                            <div className="flex items-center justify-center text-zinc-600 gap-1 mt-1 font-mono text-sm py-0.5 px-2 bg-zinc-900 rounded">
                                                <Lock className="w-3 h-3" /> Encrypted
                                            </div>
                                        )}
                                    </div>
                                    <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl w-full text-center">
                                        <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Filled Out</div>
                                        {isDecrypted ? (
                                            <div className="font-mono text-emerald-400 text-lg">{dec?.filledOut}</div>
                                        ) : (
                                            <div className="flex items-center justify-center text-zinc-600 gap-1 mt-1 font-mono text-sm py-0.5 px-2 bg-zinc-900 rounded">
                                                <Lock className="w-3 h-3" /> Encrypted
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side Actions */}
                                <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 w-full md:w-auto md:min-w-[200px] justify-end">
                                    {!isDecrypted ? (
                                        <button
                                            onClick={() => decryptOrderAmounts(order)}
                                            disabled={isActionDisabled}
                                            className="flex items-center justify-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
                                        >
                                            {actionLoading === `decrypt-${order.orderId}` ? 'Decrypting...' : <><Unlock className="w-4 h-4" /> Decrypt</>}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleClaim(order)}
                                                disabled={!order.active || isActionDisabled || dec?.filledOut === 0}
                                                className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black px-4 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                {actionLoading === `claim-${order.orderId}` ? 'Claiming...' : <><DownloadCloud className="w-4 h-4" /> Claim</>}
                                            </button>
                                            <button
                                                onClick={() => handleCancel(order)}
                                                disabled={!order.active || isActionDisabled}
                                                className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                                            >
                                                {actionLoading === `cancel-${order.orderId}` ? 'Canceling...' : <><XCircle className="w-4 h-4" /> Cancel</>}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
