import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useWeb3React } from '@web3-react/core';
import { ethers } from 'ethers';
import { Project } from '../types';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { fetchContributors } from '../api/projects';
import { processPayment } from '../api/payments';
import PaymentDistributorABI from '../contracts/PaymentDistributor.json';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    project
}) => {
    const { library, account } = useWeb3React();
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [paymentType, setPaymentType] = useState('contribution');
    const [processing, setProcessing] = useState(false);

    const { data: contributors } = useQuery(['contributors', project.id], () =>
        fetchContributors(project.id)
    );

    const paymentMutation = useMutation(processPayment, {
        onSuccess: () => {
            queryClient.invalidateQueries(['project', project.id]);
            queryClient.invalidateQueries(['payments', project.id]);
            onClose();
        }
    });

    const handlePayment = async () => {
        if (!library || !account || !amount || !contributors?.length) return;

        setProcessing(true);
        try {
            const signer = library.getSigner();
            const contract = new ethers.Contract(
                process.env.VITE_PAYMENT_DISTRIBUTOR_ADDRESS!,
                PaymentDistributorABI.abi,
                signer
            );

            // Calculate distribution based on payment type
            const distributions = contributors.map((contributor) => ({
                address: contributor.address,
                amount: ethers.parseUnits(
                    (
                        (parseFloat(amount) * contributor.contribution_weight) /
                        100
                    ).toFixed(6),
                    6
                )
            }));

            // Create batch payment
            const batchId = ethers.id(
                `${project.id}-${Date.now()}-${Math.random()}`
            );
            const recipients = distributions.map((d) => d.address);
            const amounts = distributions.map((d) => d.amount);

            // Sign the batch
            const signatures = await Promise.all(
                distributions.map(async (dist) => {
                    const message = ethers.solidityPackedKeccak256(
                        ['bytes32', 'address', 'uint256'],
                        [batchId, dist.address, dist.amount]
                    );
                    return signer.signMessage(ethers.getBytes(message));
                })
            );

            // Send transaction
            const tx = await contract.createBatch(
                batchId,
                recipients,
                amounts,
                signatures
            );
            await tx.wait();

            // Process payment on backend
            await paymentMutation.mutateAsync({
                projectId: project.id,
                amount: parseFloat(amount),
                paymentType,
                batchId,
                txHash: tx.hash,
                distributions
            });
        } catch (error) {
            console.error('Payment failed:', error);
            // Handle error (show notification, etc.)
        } finally {
            setProcessing(false);
        }
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            className="fixed inset-0 z-10 overflow-y-auto"
        >
            <div className="flex min-h-screen items-center justify-center">
                <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

                <div className="relative bg-white rounded-lg max-w-md w-full mx-4 p-6">
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                        Process Payment
                    </Dialog.Title>

                    <div className="mt-4 space-y-4">
                        <div>
                            <label
                                htmlFor="amount"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Amount (USDC)
                            </label>
                            <input
                                type="number"
                                id="amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="paymentType"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Payment Type
                            </label>
                            <select
                                id="paymentType"
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            >
                                <option value="contribution">
                                    Contribution-based
                                </option>
                                <option value="equal">Equal Distribution</option>
                                <option value="reputation">
                                    Reputation-weighted
                                </option>
                            </select>
                        </div>

                        {contributors && (
                            <div className="mt-4">
                                <h4 className="text-sm font-medium text-gray-700">
                                    Distribution Preview
                                </h4>
                                <div className="mt-2 max-h-40 overflow-y-auto">
                                    {contributors.map((contributor) => (
                                        <div
                                            key={contributor.id}
                                            className="flex justify-between py-2"
                                        >
                                            <span className="text-sm text-gray-600">
                                                {contributor.username}
                                            </span>
                                            <span className="text-sm font-medium">
                                                {(
                                                    (parseFloat(amount || '0') *
                                                        contributor.contribution_weight) /
                                                    100
                                                ).toFixed(2)}{' '}
                                                USDC
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePayment}
                                disabled={!amount || processing}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                                    !amount || processing
                                        ? 'bg-indigo-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {processing ? 'Processing...' : 'Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </Dialog>
    );
};

export default PaymentModal;
