import React from 'react';
import { useWeb3React } from '@web3-react/core';
import { InjectedConnector } from '@web3-react/injected-connector';

const injected = new InjectedConnector({
    supportedChainIds: [1, 5] // Mainnet and Goerli
});

const ConnectWallet: React.FC = () => {
    const { active, account, activate, deactivate } = useWeb3React();

    const connect = async () => {
        try {
            await activate(injected);
        } catch (error) {
            console.error('Failed to connect:', error);
        }
    };

    const disconnect = () => {
        try {
            deactivate();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    };

    return (
        <div>
            {active ? (
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
