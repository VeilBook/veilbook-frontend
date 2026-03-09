// "use client";

// import React, { useState, useEffect } from "react";
// import { ethers, BrowserProvider, Contract } from "ethers";
// import { useAccount } from "wagmi";
// import { toast } from "react-toastify";
// import { ADDRESSES, VeilBookABI } from "@/lib/constants";
// import { useFhe } from "@/components/FheProvider";
// import { ListChecks, XCircle, DownloadCloud, Unlock, Lock } from "lucide-react";

// interface OrderData {
//     orderId: string;
//     tick: number;
//     zeroForOne: boolean;
//     active: boolean;
//     amountIn: bigint;
//     amountOut: bigint;
//     filledIn: bigint;
//     filledOut: bigint;
//     timestamp: number;
// }

// interface EventLog {
//     id: string;
//     action: string;
//     orderId: string;
//     txHash: string;
//     blockNumber: number;
//     timestamp?: number;
// }

// export default function OrdersPage() {
//     const { address, isConnected } = useAccount();
//     const fhe = useFhe();
//     const [loading, setLoading] = useState<boolean>(true);
//     const [orders, setOrders] = useState<OrderData[]>([]);
//     const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
    
//     // Store decrypted values by orderId
//     const [decryptedValues, setDecryptedValues] = useState<Record<string, { filledIn?: number, filledOut?: number }>>({});
//     const [actionLoading, setActionLoading] = useState<string | null>(null);

//     const fetchOrders = async () => {
//         if (!isConnected || !address || !window.ethereum) {
//             setLoading(false);
//             return;
//         }

//         try {
//             setLoading(true);
//             const provider = new BrowserProvider(window.ethereum);
//             const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, provider);

//             // Fetch all events
//             const placedFilter = contract.filters.OrderPlaced(null, address);
//             const cancelledFilter = contract.filters.OrderCancelled(null, address);
//             const closedFilter = contract.filters.OrderClosed(null, address);
//             const claimedFilter = contract.filters.FillClaimed(null, address);

//             const [placedEvents, cancelledEvents, closedEvents, claimedEvents] = await Promise.all([
//                 contract.queryFilter(placedFilter),
//                 contract.queryFilter(cancelledFilter),
//                 contract.queryFilter(closedFilter),
//                 contract.queryFilter(claimedFilter)
//             ]);

//             // Build Orders from Placed Events
//             if (placedEvents.length === 0) {
//                 setOrders([]);
//                 setEventLogs([]);
//                 return;
//             }

//             const orderPromises = placedEvents.map(async (event) => {
//                 const id = event.args![0] as string;
//                 const block = await event.getBlock();
//                 const data = await contract.getOrder(id);
//                 return {
//                     orderId: id,
//                     tick: Number(data.tick),
//                     zeroForOne: data.zeroForOne,
//                     active: data.active,
//                     amountIn: data.amountIn,
//                     amountOut: data.amountOut,
//                     filledIn: data.filledIn,
//                     filledOut: data.filledOut,
//                     timestamp: block.timestamp * 1000
//                 } as OrderData;
//             });

//             const results = await Promise.all(orderPromises);
//             setOrders(results.sort((a, b) => b.timestamp - a.timestamp));

//             // Build Event Logs
//             const allLogs: EventLog[] = [];
//             const addLogs = (evts: any[], action: string) => {
//                 evts.forEach(e => {
//                     allLogs.push({
//                         id: `${e.transactionHash}-${e.logIndex}`,
//                         action,
//                         orderId: e.args![0],
//                         txHash: e.transactionHash,
//                         blockNumber: e.blockNumber
//                     });
//                 });
//             };

//             addLogs(placedEvents, "Placed");
//             addLogs(cancelledEvents, "Cancelled");
//             addLogs(closedEvents, "Filled/Closed");
//             addLogs(claimedEvents, "Claimed");

//             // Sort logs by blockNumber (we could fetch timestamps for all, but blockNumber is close enough for sorting)
//             setEventLogs(allLogs.sort((a, b) => b.blockNumber - a.blockNumber));

//         } catch (error) {
//             console.error("Error fetching orders:", error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     useEffect(() => {
//         if (isConnected) {
//             fetchOrders();
//         } else {
//             setOrders([]);
//             setLoading(false);
//         }
//     }, [isConnected, address]);

//     // ZAMA SDK DECRYPTION LOGIC
//     const decryptOrderAmounts = async (order: OrderData) => {
//         if (!fhe || !address || !window.ethereum) return;
        
//         try {
//             setActionLoading(`decrypt-${order.orderId}`);
//             toast.info("Signing decryption request...");

//             const provider = new BrowserProvider(window.ethereum);
//             const signer = await provider.getSigner();

//             // We want to decrypt both filledIn and filledOut
//             const handles = [order.filledIn, order.filledOut];
//             const handleContractPairs = handles.map(h => ({
//                 handle: h,
//                 contractAddress: ADDRESSES.VeilBook
//             }));

//             const keypair = fhe!.generateKeypair();
//             const startTimeStamp = Math.floor(Date.now() / 1000).toString();
//             const durationDays = "1";
//             const contractAddresses = [ADDRESSES.VeilBook];

//             const eip712 = fhe!.createEIP712(
//                 keypair.publicKey, 
//                 contractAddresses, 
//                 startTimeStamp, 
//                 durationDays
//             );
            
//             const signature = await signer!.signTypedData(
//                 eip712.domain,
//                 { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
//                 eip712.message,
//             );

//             toast.info("Waiting for Relayer decryption response...");
//             const result = await fhe.userDecrypt(
//                 handleContractPairs,
//                 keypair.privateKey,
//                 keypair.publicKey,
//                 signature!.replace("0x", ""),
//                 contractAddresses,
//                 signer!.address,
//                 startTimeStamp,
//                 durationDays,
//             );

//             // The resulting object is keyed by the bigint handles string format
//             const valIn = Number(result[order.filledIn.toString()]);
//             const valOut = Number(result[order.filledOut.toString()]);

//             setDecryptedValues(prev => ({
//                 ...prev,
//                 [order.orderId]: { filledIn: valIn, filledOut: valOut }
//             }));

//             toast.success("Successfully decrypted filled amounts!");
//         } catch (error: any) {
//             console.error("Decryption failed:", error);
//             toast.error(error?.reason || error?.message || "Decryption failed");
//         } finally {
//             setActionLoading(null);
//         }
//     };

//     const handleCancel = async (order: OrderData) => {
//         if (!window.ethereum) return;
        
//         const decrypted = decryptedValues[order.orderId];
//         if (!decrypted || decrypted.filledIn === undefined) {
//             toast.error("Please decrypt the order first to calculate the unfilled amount!");
//             return;
//         }

//         try {
//             setActionLoading(`cancel-${order.orderId}`);
//             const provider = new BrowserProvider(window.ethereum);
//             const signer = await provider.getSigner();
//             const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, signer);

//             // We don't know the exact starting amount in plaintext! 
//             // In a real P2P FHE environment, the frontend would probably have locally saved the initial amountIn. 
//             // The instructions say "unfilled = amountIn - filledIn". But wait, amountIn is an encrypted handle in the contract.
//             // Wait, we DO know the initial amount because the user placed it, but they might have refreshed the page.
//             // If they didn't save it, they can technically pass max uint64 or prompt user.
//             // For now, let's ask the user how much they THINK is unfilled or prompt them.
            
//             const assumedOriginalAmount = prompt(`You have ${decrypted.filledIn} filled so far. What was your ORIGINAL TOTAL deposit amount you wanted to cancel from? \n(Enter full amount in tokens, no decimals needed since we parse it according to token type but actually since it is a dummy prompt just write raw integer value like 1000000 for 1 token if USDC)`);
            
//             if (!assumedOriginalAmount) {
//                 toast.info("Cancellation aborted.");
//                 setActionLoading(null);
//                 return;
//             }

//             const totalInNumber = Number(assumedOriginalAmount);
//             const unfilled = totalInNumber - decrypted.filledIn;

//             if (unfilled < 0) {
//                 toast.error("Unfilled amount cannot be negative");
//                 return;
//             }

//             const tx = await contract.cancelOrder(order.orderId, unfilled);
//             toast.info("Canceling order...", { autoClose: false, toastId: 'canceling' });
//             await tx.wait();

//             toast.dismiss('canceling');
//             toast.success("Order cancelled successfully!");
//             await fetchOrders();
//         } catch (error: any) {
//             console.error("Cancel failed:", error);
//             toast.error(error?.reason || error?.message || "Cancel failed");
//         } finally {
//             setActionLoading(null);
//         }
//     };

//     const handleClaim = async (order: OrderData) => {
//         if (!window.ethereum) return;
        
//         const decrypted = decryptedValues[order.orderId];
//         if (!decrypted || decrypted.filledOut === undefined) {
//             toast.error("Please decrypt the order first to view filled amounts!");
//             return;
//         }

//         try {
//             setActionLoading(`claim-${order.orderId}`);
//             const provider = new BrowserProvider(window.ethereum);
//             const signer = await provider.getSigner();
//             const contract = new Contract(ADDRESSES.VeilBook, VeilBookABI, signer);

//             // Actually claim Fill uses the filledOut plaintext 
//             const tx = await contract.claimFill(order.orderId, decrypted.filledOut);
//             toast.info("Claiming filled tokens...", { autoClose: false, toastId: 'claiming' });
//             await tx.wait();

//             toast.dismiss('claiming');
//             toast.success("Tokens claimed successfully!");
//             await fetchOrders();
//         } catch (error: any) {
//             console.error("Claim failed:", error);
//             toast.error(error?.reason || error?.message || "Claim failed");
//         } finally {
//             setActionLoading(null);
//         }
//     };

//     return (
//         <div className="flex flex-col items-center justify-start min-h-[80vh] w-full max-w-6xl mx-auto py-10 space-y-12">
            
//             <div className="space-y-4 text-center">
//                 <div className="inline-flex items-center justify-center rounded-full bg-emerald-500/10 p-4 text-emerald-500 mb-2 border border-emerald-500/20">
//                     <ListChecks className="h-8 w-8" />
//                 </div>
//                 <h1 className="text-4xl font-bold tracking-tight text-white">Your Orders</h1>
//                 <p className="text-zinc-400 max-w-lg mx-auto">
//                     Manage your active limit orders, decrypt filled balances confidentially, and claim settlements.
//                 </p>
//             </div>

//             {loading ? (
//                 <div className="flex items-center justify-center py-20">
//                     <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
//                 </div>
//             ) : !isConnected ? (
//                 <div className="text-center py-10 px-6 rounded-2xl w-full max-w-lg bg-white/10 border border-white/30 text-white">
//                     <p className="font-semibold">Connect Wallet to view your orders.</p>
//                 </div>
//             ) : orders.length === 0 ? (
//                 <div className="text-center py-20 text-zinc-500 bg-zinc-900/40 rounded-2xl w-full border border-zinc-800">
//                     <p>No orders found. Head to the Trade tab to place your first limit order.</p>
//                 </div>
//             ) : (
//                 <div className="w-full flex flex-col space-y-12">
//                     <div className="space-y-4">
//                         <h2 className="text-xl font-bold text-white mb-4">Your Limits</h2>
//                         {orders.map((order) => {
//                         const isDecrypted = decryptedValues[order.orderId] !== undefined;
//                         const dec = decryptedValues[order.orderId];
//                         const isActionDisabled = actionLoading !== null;

//                         return (
//                             <div 
//                                 key={order.orderId}
//                                 className={`flex flex-col md:flex-row items-center justify-between p-6 bg-zinc-900/60 border rounded-2xl transition-all w-full
//                                     ${order.active ? 'border-zinc-700 hover:border-emerald-500/50' : 'border-red-900/30 opacity-70'}
//                                 `}
//                             >
//                                 {/* Left Side Details */}
//                                 <div className="flex flex-col space-y-2 w-full md:w-1/3 mb-6 md:mb-0">
//                                     <div className="flex items-center gap-3">
//                                         <span className={`px-2 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md border
//                                             ${order.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}
//                                         `}>
//                                             {order.active ? 'Active' : 'Closed / Cancelled'}
//                                         </span>
//                                         <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md border
//                                             ${order.zeroForOne ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}
//                                         `}>
//                                             {order.zeroForOne ? 'SELL 0 FOR 1' : 'BUY 0 WITH 1'}
//                                         </span>
//                                     </div>
//                                     <div className="font-mono text-xs text-zinc-500 mt-2 break-all bg-black/50 p-2 rounded-lg border border-zinc-900">
//                                         ID: {order.orderId}
//                                     </div>
//                                     <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-wider">
//                                         {new Date(order.timestamp).toLocaleString()}
//                                     </div>
//                                     <p className="text-white font-semibold flex items-center gap-2 mt-2">
//                                         Tick Execution: <span className="font-mono bg-zinc-800 px-2 py-0.5 rounded text-white">{order.tick}</span>
//                                     </p>
//                                 </div>

//                                 {/* Center Balances (Encrypted / Decrypted) */}
//                                 <div className="flex flex-col sm:flex-row gap-4 w-full md:w-1/3 items-center justify-center mb-6 md:mb-0">
//                                     <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl w-full text-center">
//                                         <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Filled In</div>
//                                         {isDecrypted ? (
//                                             <div className="font-mono text-white text-lg">{dec?.filledIn}</div>
//                                         ) : (
//                                             <div className="flex items-center justify-center text-zinc-600 gap-1 mt-1 font-mono text-sm py-0.5 px-2 bg-zinc-900 rounded">
//                                                 <Lock className="w-3 h-3" /> Encrypted
//                                             </div>
//                                         )}
//                                     </div>
//                                     <div className="bg-black/40 border border-zinc-800 p-3 rounded-xl w-full text-center">
//                                         <div className="text-[10px] uppercase text-zinc-500 font-bold mb-1">Filled Out</div>
//                                         {isDecrypted ? (
//                                             <div className="font-mono text-emerald-400 text-lg">{dec?.filledOut}</div>
//                                         ) : (
//                                             <div className="flex items-center justify-center text-zinc-600 gap-1 mt-1 font-mono text-sm py-0.5 px-2 bg-zinc-900 rounded">
//                                                 <Lock className="w-3 h-3" /> Encrypted
//                                             </div>
//                                         )}
//                                     </div>
//                                 </div>

//                                 {/* Right Side Actions */}
//                                 <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 w-full md:w-auto md:min-w-[200px] justify-end">
//                                     {!isDecrypted ? (
//                                         <button
//                                             onClick={() => decryptOrderAmounts(order)}
//                                             disabled={isActionDisabled}
//                                             className="flex items-center justify-center gap-2 bg-white text-black px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50"
//                                         >
//                                             {actionLoading === `decrypt-${order.orderId}` ? 'Decrypting...' : <><Unlock className="w-4 h-4"/> Decrypt Forms</>}
//                                         </button>
//                                     ) : (
//                                         <>
//                                             <button
//                                                 onClick={() => handleClaim(order)}
//                                                 disabled={!order.active || isActionDisabled || dec?.filledOut === 0}
//                                                 className="flex items-center justify-center gap-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black px-4 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
//                                             >
//                                                 {actionLoading === `claim-${order.orderId}` ? 'Claiming...' : <><DownloadCloud className="w-4 h-4"/> Claim</>}
//                                             </button>
//                                             <button
//                                                 onClick={() => handleCancel(order)}
//                                                 disabled={!order.active || isActionDisabled}
//                                                 className="flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white px-4 py-2.5 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
//                                             >
//                                                 {actionLoading === `cancel-${order.orderId}` ? 'Canceling...' : <><XCircle className="w-4 h-4"/> Cancel</>}
//                                             </button>
//                                         </>
//                                     )}
//                                 </div>

//                             </div>
//                         );
//                     })}
//                     </div>

//                     <div className="space-y-4 pt-8 border-t border-zinc-800/50">
//                         <h2 className="text-xl font-bold text-white mb-4">Event History</h2>
//                         <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
//                             <table className="w-full min-w-[600px]">
//                                 <thead>
//                                     <tr className="bg-zinc-800/50 border-b border-zinc-800/80 text-left text-xs uppercase tracking-wider text-zinc-400 font-bold">
//                                         <th className="p-4 px-6">Action</th>
//                                         <th className="p-4">Order ID</th>
//                                         <th className="p-4">Block</th>
//                                         <th className="p-4 text-right">View Tx</th>
//                                     </tr>
//                                 </thead>
//                                 <tbody>
//                                     {eventLogs.length === 0 ? (
//                                         <tr>
//                                             <td colSpan={4} className="p-6 text-center text-zinc-500">No events found.</td>
//                                         </tr>
//                                     ) : (
//                                         eventLogs.map(log => (
//                                             <tr key={log.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
//                                                 <td className="p-4 px-6">
//                                                     <span className={`px-2.5 py-1 text-[10px] uppercase font-bold rounded-md border
//                                                         ${log.action === 'Placed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : ''}
//                                                         ${log.action === 'Cancelled' ? 'bg-red-500/10 text-red-500 border-red-500/20' : ''}
//                                                         ${log.action === 'Filled/Closed' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : ''}
//                                                         ${log.action === 'Claimed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}
//                                                     `}>{log.action}</span>
//                                                 </td>
//                                                 <td className="p-4 font-mono text-xs text-zinc-300">
//                                                     {log.orderId.substring(0, 10)}...{log.orderId.substring(60)}
//                                                 </td>
//                                                 <td className="p-4 text-sm text-zinc-400 font-mono text-white/80">{log.blockNumber}</td>
//                                                 <td className="p-4 text-right">
//                                                     <a href={`https://sepolia.etherscan.io/tx/${log.txHash}`} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider underline">Link</a>
//                                                 </td>
//                                             </tr>
//                                         ))
//                                     )}
//                                 </tbody>
//                             </table>
//                         </div>
//                     </div>
//                 </div>
//             )}

//         </div>
//     );
// }
