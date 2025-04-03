import React from 'react';
import { useWeb3React } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import type { EthereumProvider } from '../services/web3';

const ConnectWallet: React.FC = () => {
    const { account, isActive } = useWeb3React<Web3Provider>();

    const connect = async () => {
        try {
            if (typeof window.ethereum === 'undefined') {
                throw new Error('Please install MetaMask to use this feature');
            }
            const ethereum = window.ethereum as unknown as EthereumProvider;
            // Request account access
            await ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            console.error('Failed to connect:', error);
        }
    };

    const disconnect = () => {
        try {
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask is not installed');
            }
            const ethereum = window.ethereum as unknown as EthereumProvider;
            // Clear the selected address
            ethereum.selectedAddress = null;
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    return (
        <div>
            {isActive ? (
                <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-700">
                        Connected: {account?.slice(0, 6)}...
                        {account?.slice(-4)}
                    </span>
                    <button
                        onClick={disconnect}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        Disconnect
                    </button>
                </div>
            ) : (
                <button
                    onClick={connect}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    Connect Wallet
                </button>
            )}
        </div>
    );
};

export default ConnectWallet;
