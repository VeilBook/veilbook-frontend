
'use client';
import type { Metadata } from 'next';
import { PT_Mono } from 'next/font/google';
import './globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import Header from '@/components/Header';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { useEffect, useMemo, useState } from 'react';
import type { Account, Chain, Client, Transport } from 'viem';
import { type Config, useClient, useConnectorClient } from 'wagmi';
import { FallbackProvider, JsonRpcProvider } from 'ethers';
import { queryClient } from '@/lib/react-query';
import { wagmiConfig } from '@/config/wagmi';
import { ToastContainer } from 'react-toastify';
import Script from 'next/script';
import { FheProvider } from '@/components/FheProvider';
import Footer from '@/components/Footer';

const PT_Mono_ = PT_Mono({
    subsets: ['latin'],
    weight: ['400'],
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <Script
                src="https://cdn.zama.org/relayer-sdk-js/0.3.0-5/relayer-sdk-js.umd.cjs"
                 type="text/javascript" strategy='beforeInteractive' />
            </head>
            <body
                className={`${PT_Mono_.className} antialiased overflow-x-hidden text-sm`}
            >

                <div className="bg-black">
                    <WagmiProvider config={wagmiConfig}>
                        <QueryClientProvider client={queryClient}>
                                <RainbowKitProvider>
                                    <FheProvider>
                                    <Header />
                                    <div className="min-h-screen max-w-7xl mx-auto space-y-8 px-5 py-14 lg:px-10">
                                        {children}
                                    </div>
                                     <ToastContainer
                                        position="top-right"
                                        autoClose={3000}
                                        hideProgressBar={false}
                                        newestOnTop={false}
                                        closeOnClick
                                        pauseOnFocusLoss
                                        draggable
                                        pauseOnHover
                                        theme="colored"
                                    />
                                    <Footer />
                                    </FheProvider>
                                </RainbowKitProvider>
                        </QueryClientProvider>
                    </WagmiProvider>
                </div>
            </body>
        </html>
    );
}



