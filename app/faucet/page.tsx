"use client";

import React, { useState, useEffect } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";
import { useAccount, useConfig } from "wagmi";
import { toast } from "react-toastify";
import { ADDRESSES, MockERC20ABI } from "@/lib/constants";
import { Droplet, RefreshCw } from "lucide-react";

export default function FaucetParams() {
    const { address, isConnected } = useAccount();
    const config = useConfig();
    const [balances, setBalances] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const tokens = [
        { symbol: "USDC", address: ADDRESSES.Tokens.USDC, decimals: 6 },
        { symbol: "NBL", address: ADDRESSES.Tokens.NBL, decimals: 6 },
        { symbol: "SLR", address: ADDRESSES.Tokens.SLR, decimals: 6 },
        { symbol: "ATH", address: ADDRESSES.Tokens.ATH, decimals: 6 },
        { symbol: "VTX", address: ADDRESSES.Tokens.VTX, decimals: 6 },
        { symbol: "ZTA", address: ADDRESSES.Tokens.ZTA, decimals: 6 },
    ];

    const fetchBalances = async () => {
        if (!isConnected || !address || !window.ethereum) return;

        try {
            const provider = new BrowserProvider(window.ethereum);
            const newBalances: Record<string, string> = {};

            for (const token of tokens) {
                const contract = new Contract(token.address, MockERC20ABI, provider);
                const bal = await contract.balanceOf(address);
                newBalances[token.symbol] = ethers.formatUnits(bal, token.decimals);
            }
            setBalances(newBalances);
        } catch (error) {
            console.error("Error fetching balances:", error);
        }
    };

    useEffect(() => {
        fetchBalances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address, isConnected]);

    const handleMint = async (symbol: string, tokenAddress: string, decimals: number) => {
        if (!isConnected || !address || !window.ethereum) {
            toast.error("Please connect your wallet first.");
            return;
        }

        try {
            setLoading((prev) => ({ ...prev, [symbol]: true }));
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            const contract = new Contract(tokenAddress, MockERC20ABI, signer);
            
            // Mint 1000 tokens based on decimals
            const amountToMint = ethers.parseUnits("1000", decimals);
            
            const tx = await contract.mint(address, amountToMint);
            toast.info(`Minting 1000 ${symbol}... Please wait.`);
            await tx.wait();
            
            toast.success(`Successfully minted 1000 ${symbol}!`);
            await fetchBalances(); // refresh balance
        } catch (error: any) {
            console.error(`Mint error for ${symbol}:`, error);
            toast.error(error?.reason || error?.message || `Failed to mint ${symbol}`);
        } finally {
            setLoading((prev) => ({ ...prev, [symbol]: false }));
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-[80vh] text-center w-full max-w-5xl mx-auto py-10 space-y-12">
            <div className="space-y-4">
                <div className="inline-flex items-center justify-center rounded-full bg-blue-500/10 p-4 text-blue-500 mb-2 border border-blue-500/20">
                    <Droplet className="h-8 w-8" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-white">Testnet Faucet</h1>
                <p className="text-zinc-400 max-w-lg mx-auto">
                    Mint free testnet tokens to use on the VeilBook limit order protocol.
                </p>
            </div>

            <div className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                {tokens.map((token) => (
                    <div
                        key={token.symbol}
                        className="flex flex-col items-center p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-sm transition-all hover:border-zinc-700 w-full"
                    >
                        <div className="w-full flex justify-between items-center mb-6">
                            <span className="text-xl font-bold text-white">{token.symbol}</span>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800">
                                {token.address.slice(0, 6)}...{token.address.slice(-4)}
                            </span>
                        </div>

                        <div className="w-full flex flex-col space-y-1 mb-8 text-left bg-black/40 rounded-xl p-4 border border-zinc-900">
                            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Your Balance</span>
                            <span className="text-2xl font-mono text-zinc-200">
                                {balances[token.symbol] ? Number(balances[token.symbol]).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0.00"}
                            </span>
                        </div>

                        <button
                            onClick={() => handleMint(token.symbol, token.address, token.decimals)}
                            disabled={loading[token.symbol] || !isConnected}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white text-black font-semibold rounded-xl transition hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading[token.symbol] ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Minting...
                                </>
                            ) : (
                                "Mint 1000 Tokens"
                            )}
                        </button>
                    </div>
                ))}
            </div>
            
            {!isConnected && (
                <p className="text-sm text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/30 px-6 py-3 rounded-lg flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                    Please connect your wallet to mint tokens.
                </p>
            )}
        </div>
    );
}
