import React from 'react';
import { useWeb3React } from '@web3-react/core';
import { Web3Provider } from '@ethersproject/providers';
import { MetaMask } from '@web3-react/metamask';
import { EthereumProvider } from '../services/web3';

const ConnectWallet: React.FC = () => {
    const { account, isActive, connector } = useWeb3React<Web3Provider>();

    const connect = async () => {
        try {
            const ethereum = window.ethereum as EthereumProvider;
            if (!ethereum) {
                throw new Error('MetaMask not found');
            }
            await ethereum.request({ method: 'eth_requestAccounts' });
        } catch (error) {
            console.error('Failed to connect:', error);
        }
    };

    const disconnect = async () => {
        try {
            const ethereum = window.ethereum as EthereumProvider;
            if (!connector) {
                console.error('No connector found');
                return;
            }
            
            if (!(connector instanceof MetaMask)) {
                console.error('Not a MetaMask connector');
                return;
            }
            
            await ethereum.request({ method: 'eth_disconnect' });
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
