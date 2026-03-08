'use client';
import React, { useState } from 'react';
import { Logo } from './Logo';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const Header: React.FC = () => {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <nav className="bg-black border-b border-zinc-900 shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <Logo />

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-6">
                        <Link
                            href="/faucet"
                            className="text-zinc-400 hover:text-white transition-colors font-medium"
                        >
                            Faucet
                        </Link>
                        <Link
                            href="/pools"
                            className="text-zinc-400 hover:text-white transition-colors font-medium"
                        >
                            Pools
                        </Link>
                        <Link
                            href="/trade"
                            className="text-zinc-400 hover:text-white transition-colors font-medium"
                        >
                            Trade
                        </Link>
                        <Link
                            href="/profile"
                            className="text-zinc-400 hover:text-white transition-colors font-medium"
                        >
                            Profile
                        </Link>

                        <div className="pl-4 border-l border-zinc-900">
                            <ConnectButton showBalance={true} />
                        </div>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMobileOpen(!isMobileOpen)}
                            className="text-zinc-400 hover:text-white p-2"
                        >
                            <svg
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                {isMobileOpen ? (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                ) : (
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                )}
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMobileOpen && (
                <div className="md:hidden border-t border-zinc-900">
                    <div className="px-4 pt-4 pb-6 space-y-4 bg-black">
                        <Link
                            href="/faucet"
                            className="block text-zinc-400 hover:text-white text-base font-medium"
                            onClick={() => setIsMobileOpen(false)}
                        >
                            Faucet
                        </Link>
                        <Link
                            href="/pools"
                            className="block text-zinc-400 hover:text-white text-base font-medium"
                            onClick={() => setIsMobileOpen(false)}
                        >
                            Pools
                        </Link>
                        <Link
                            href="/trade"
                            className="block text-zinc-400 hover:text-white text-base font-medium"
                            onClick={() => setIsMobileOpen(false)}
                        >
                            Trade
                        </Link>
                        <Link
                            href="/profile"
                            className="block text-zinc-400 hover:text-white text-base font-medium"
                            onClick={() => setIsMobileOpen(false)}
                        >
                            Profile
                        </Link>
        
                        <div className="pt-4 border-t border-zinc-900">
                            <ConnectButton showBalance={true} />
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Header;
