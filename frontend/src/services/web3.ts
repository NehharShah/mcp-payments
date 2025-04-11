import { ethers, ContractRunner, Log, BrowserProvider, Contract, Interface } from 'ethers';
import PaymentDistributorABI from '../../../out/PaymentDistributor.sol/PaymentDistributor.json';
import LiquidityPoolABI from '../../../out/LiquidityPool.sol/LiquidityPool.json';

// Define Ethereum provider interface that matches EIP-1193
export interface ProviderRpcError extends Error {
  code: number;
  data?: unknown;
}

export interface ProviderMessage {
  type: string;
  data: unknown;
}

export interface RequestArguments {
  method: string;
  params?: readonly unknown[] | object;
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  selectedAddress: string | null;
  chainId?: string;
  enable?(): Promise<string[]>;
  request(args: RequestArguments): Promise<unknown>;
  on(eventName: string, handler: (args: any) => void): void;
  removeListener(eventName: string, handler: (args: any) => void): void;
  once(eventName: string, handler: (args: any) => void): void;
  emit(eventName: string, args: any): void;
}

// Extend window interface
declare global {
  interface WindowEventMap {
    ethereum: EthereumProvider;
  }
}

const PAYMENT_DISTRIBUTOR_ADDRESS = import.meta.env.VITE_PAYMENT_DISTRIBUTOR_ADDRESS as string;
const LIQUIDITY_POOL_ADDRESS = import.meta.env.VITE_LIQUIDITY_POOL_ADDRESS as string;
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '1337');

if (!PAYMENT_DISTRIBUTOR_ADDRESS || !LIQUIDITY_POOL_ADDRESS) {
  throw new Error('Contract addresses not properly configured');
}

export class Web3Service {
  private provider: BrowserProvider | null = null;
  private signer: ContractRunner | null = null;
  private distributorContract: Contract | null = null;
  private liquidityPoolContract: Contract | null = null;
  private distributorInterface: Interface;
  private ethereum: EthereumProvider | null = null;

  constructor() {
    this.distributorInterface = new ethers.Interface(PaymentDistributorABI.abi);
  }

  async connect() {
    if (!window.ethereum) {
      throw new Error('Please install MetaMask!');
    }

    this.ethereum = window.ethereum as EthereumProvider;

    // Check if we're on the right network
    const chainId = await this.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId as string, 16) !== CHAIN_ID) {
      try {
        await this.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
        });
      } catch (error: any) {
        if (error.code === 4902) {
          throw new Error('Please add and switch to the correct network in MetaMask');
        }
        throw error;
      }
    }

    // Request account access
    await this.ethereum.request({ method: 'eth_requestAccounts' });
      
    // Initialize provider and contracts
    this.provider = new ethers.BrowserProvider(this.ethereum);
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

    // Listen for chain changes
    const handleChainChanged = (chainId: string) => {
      if (parseInt(chainId, 16) !== CHAIN_ID) {
        this.disconnect();
      }
    };

    this.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      this.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }

  disconnect() {
    if (this.ethereum) {
      // Remove all listeners
      this.ethereum.removeListener('chainChanged', () => {});
    }
    this.ethereum = null;
    this.provider = null;
    this.signer = null;
    this.distributorContract = null;
    this.liquidityPoolContract = null;
  }

  async createBatch(recipients: string[], amounts: string[]) {
    if (!this.distributorContract) throw new Error('Not connected to Web3');
    
    try {
      const tx = await this.distributorContract.createBatch(
        recipients,
        amounts.map(amount => ethers.parseUnits(amount, 6)) // Assuming USDC with 6 decimals
      );
      const receipt = await tx.wait();
      
      // Find the BatchCreatedEvent
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsedLog = this.distributorInterface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          return parsedLog?.name === 'BatchCreatedEvent';
        } catch {
          return false;
        }
      });
      
      if (!event) throw new Error('Batch creation failed: Event not found');
      
      const parsedLog = this.distributorInterface.parseLog({
        topics: event.topics as string[],
        data: event.data
      });
      
      return parsedLog?.args?.batchId as string;
    } catch (error) {
      console.error('Error creating batch:', error);
      throw new Error('Failed to create batch');
    }
  }

  async processPayment(batchId: string, index: number, signature: string) {
    if (!this.distributorContract) throw new Error('Not connected to Web3');
    
    try {
      const tx = await this.distributorContract.processPayment(batchId, index, signature);
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw new Error('Failed to process payment');
    }
  }

  async getBatchPayment(batchId: string, index: number) {
    if (!this.distributorContract) throw new Error('Not connected to Web3');
    
    try {
      const payment = await this.distributorContract.batchPayments(batchId, index);
      return {
        recipient: payment.recipient,
        amount: ethers.formatUnits(payment.amount, 6),
        processed: payment.processed,
        createdAt: new Date(Number(payment.createdAt) * 1000),
        signature: payment.signature
      };
    } catch (error) {
      console.error('Error getting batch payment:', error);
      throw new Error('Failed to get batch payment');
    }
  }

  async getBatchCount(batchId: string) {
    if (!this.distributorContract) throw new Error('Not connected to Web3');
    
    try {
      const count = await this.distributorContract.batchCounts(batchId);
      return Number(count);
    } catch (error) {
      console.error('Error getting batch count:', error);
      throw new Error('Failed to get batch count');
    }
  }

  async disputePayment(batchId: string, paymentIndex: number) {
    if (!this.distributorContract) throw new Error('Not connected to Web3');
    try {
      const tx = await this.distributorContract.disputePayment(
        ethers.id(batchId),
        paymentIndex
      );
      return await tx.wait();
    } catch (error) {
      console.error('Error disputing payment:', error);
      throw new Error('Failed to dispute payment');
    }
  }

  async swapTokens(fromToken: string, toToken: string, amount: string, minAmount: string) {
    if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
    try {
      const tx = await this.liquidityPoolContract.swap(
        fromToken,
        toToken,
        ethers.parseEther(amount),
        ethers.parseEther(minAmount)
      );
      return await tx.wait();
    } catch (error) {
      console.error('Error swapping tokens:', error);
      throw new Error('Failed to swap tokens');
    }
  }

  async addLiquidity(token: string, amount: string) {
    if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
    try {
      const tx = await this.liquidityPoolContract.addLiquidity(
        token,
        ethers.parseEther(amount)
      );
      return await tx.wait();
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw new Error('Failed to add liquidity');
    }
  }

  async removeLiquidity(token: string, amount: string) {
    if (!this.liquidityPoolContract) throw new Error('Not connected to Web3');
    try {
      const tx = await this.liquidityPoolContract.removeLiquidity(
        token,
        ethers.parseEther(amount)
      );
      return await tx.wait();
    } catch (error) {
      console.error('Error removing liquidity:', error);
      throw new Error('Failed to remove liquidity');
    }
  }

  async getTokenBalance(tokenAddress: string): Promise<string> {
    if (!this.provider || !this.signer) throw new Error('Not connected to Web3');
    try {
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );
      const balance = await tokenContract.balanceOf(await this.signer.getAddress());
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw new Error('Failed to get token balance');
    }
  }
}

export const web3Service = new Web3Service();