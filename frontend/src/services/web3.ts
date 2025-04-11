import { ethers } from 'ethers';
import PaymentDistributorABI from '../../../out/PaymentDistributor.sol/PaymentDistributor.json';
import LiquidityPoolABI from '../../../out/LiquidityPool.sol/LiquidityPool.json';

const PAYMENT_DISTRIBUTOR_ADDRESS = import.meta.env.VITE_PAYMENT_DISTRIBUTOR_ADDRESS as string;
const LIQUIDITY_POOL_ADDRESS = import.meta.env.VITE_LIQUIDITY_POOL_ADDRESS as string;

export class Web3Service {
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;
    private distributorContract: ethers.Contract | null = null;
    private liquidityPoolContract: ethers.Contract | null = null;

    constructor() {}

    async connect() {
        if (typeof window.ethereum !== 'undefined') {
            const ethereumProvider = window.ethereum as unknown as ethers.Eip1193Provider;
            this.provider = new ethers.BrowserProvider(ethereumProvider);
            this.signer = await this.provider.getSigner();
            this.distributorContract = new ethers.Contract(
                PAYMENT_DISTRIBUTOR_ADDRESS,
                PaymentDistributorABI.abi,
                this.signer
            );
            this.liquidityPoolContract = new ethers.Contract(
                LIQUIDITY_POOL_ADDRESS,
                LiquidityPoolABI.abi,
                this.signer
            );
        } else {
            throw new Error('Please install MetaMask!');
        }
    }

    async connectWallet(): Promise<string> {
        if (!this.provider) await this.connect();
        await this.provider!.send("eth_requestAccounts", []);
        return await this.signer!.getAddress();
    }

    async createBatch(recipients: string[], amounts: string[]) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        
        const tx = await this.distributorContract.createBatch(
            recipients,
            amounts.map(amount => ethers.parseUnits(amount, 6)) // Assuming USDC with 6 decimals
        );
        return await tx.wait();
    }

    async processPayment(batchId: string, index: number, signature: string) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        
        const tx = await this.distributorContract.processPayment(batchId, index, signature);
        return await tx.wait();
    }

    async getBatchPayment(batchId: string, index: number) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        
        const payment = await this.distributorContract.batchPayments(batchId, index);
        return {
            recipient: payment.recipient,
            amount: ethers.formatUnits(payment.amount, 6),
            processed: payment.processed,
            createdAt: new Date(Number(payment.createdAt) * 1000),
            signature: payment.signature
        };
    }

    async getBatchCount(batchId: string) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        return Number(await this.distributorContract.batchCounts(batchId));
    }

    async createBatchPayment(
        batchId: string,
        recipients: string[],
        amounts: string[],
        signatures: string[]
    ) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        const tx = await this.distributorContract.createBatch(
            ethers.id(batchId),
            recipients,
            amounts.map(a => ethers.parseEther(a)),
            signatures
        );
        return await tx.wait();
    }

    async processBatchPayment(batchId: string) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        const tx = await this.distributorContract.processBatch(
            ethers.id(batchId)
        );
        return await tx.wait();
    }

    async disputePayment(
        batchId: string,
        paymentIndex: number
    ) {
        if (!this.distributorContract) throw new Error('Not connected to Web3');
        const tx = await this.distributorContract.disputePayment(
            ethers.id(batchId),
            paymentIndex
        );
        return await tx.wait();
    }

    async swapTokens(
        fromToken: string,
        toToken: string,
        amount: string,
        minAmount: string
    ) {
        if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
        const tx = await this.liquidityPoolContract.swap(
            fromToken,
            toToken,
            ethers.parseEther(amount),
            ethers.parseEther(minAmount)
        );
        return await tx.wait();
    }

    async addLiquidity(
        token: string,
        amount: string
    ) {
        if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
        const tx = await this.liquidityPoolContract.addLiquidity(
            token,
            ethers.parseEther(amount)
        );
        return await tx.wait();
    }

    async removeLiquidity(
        token: string,
        amount: string
    ) {
        if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
        const tx = await this.liquidityPoolContract.removeLiquidity(
            token,
            ethers.parseEther(amount)
        );
        return await tx.wait();
    }

    async getTokenBalance(tokenAddress: string): Promise<string> {
        if (!this.provider) throw new Error('Not connected to Web3');
        const tokenContract = new ethers.Contract(
            tokenAddress,
            ['function balanceOf(address) view returns (uint256)'],
            this.provider
        );
        const balance = await tokenContract.balanceOf(await this.signer!.getAddress());
        return ethers.formatEther(balance);
    }
}

export const web3Service = new Web3Service();
