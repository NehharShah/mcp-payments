import { ethers, ContractRunner, Log, BrowserProvider, Contract, Interface } from 'ethers';

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

const PAYMENT_DISTRIBUTOR_ADDRESS = import.meta.env.VITE_PAYMENT_DISTRIBUTOR_ADDRESS;
const CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '1337');

if (!PAYMENT_DISTRIBUTOR_ADDRESS) {
  throw new Error('Payment distributor address not configured');
}

const PAYMENT_DISTRIBUTOR_ABI = [
  'function createBatch(address[] calldata recipients, uint256[] calldata amounts) external',
  'function processPayment(bytes32 batchId, uint256 index, bytes calldata signature) external nonReentrant whenNotPaused',
  'function batchPayments(bytes32, uint256) public view returns (address recipient, uint256 amount, bool processed, uint256 createdAt, bytes signature)',
  'function batchCounts(bytes32) public view returns (uint256)',
  'event BatchCreatedEvent(bytes32 indexed batchId)',
  'event PaymentProcessedEvent(bytes32 indexed batchId, address indexed recipient, uint256 amount, bytes signature)'
];

export class Web3Service {
  private provider: BrowserProvider | null = null;
  private signer: ContractRunner | null = null;
  private contract: Contract | null = null;
  private contractInterface: Interface;
  private ethereum: EthereumProvider | null = null;

  constructor() {
    this.contractInterface = new ethers.Interface(PAYMENT_DISTRIBUTOR_ABI);
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
      
    // Initialize provider using BrowserProvider
    this.provider = new ethers.BrowserProvider(this.ethereum);
    this.signer = await this.provider.getSigner();
    this.contract = new ethers.Contract(
      PAYMENT_DISTRIBUTOR_ADDRESS,
      PAYMENT_DISTRIBUTOR_ABI,
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
    this.contract = null;
  }

  async createBatch(recipients: string[], amounts: string[]) {
    if (!this.contract) throw new Error('Not connected to Web3');
    
    try {
      const tx = await this.contract.createBatch(
        recipients,
        amounts.map(amount => ethers.parseUnits(amount, 6)) // Assuming USDC with 6 decimals
      );
      const receipt = await tx.wait();
      
      // Find the BatchCreatedEvent
      const event = receipt.logs.find((log: Log) => {
        try {
          const parsedLog = this.contractInterface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
          return parsedLog?.name === 'BatchCreatedEvent';
        } catch {
          return false;
        }
      });
      
      if (!event) throw new Error('Batch creation failed: Event not found');
      
      const parsedLog = this.contractInterface.parseLog({
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
    if (!this.contract) throw new Error('Not connected to Web3');
    
    try {
      const tx = await this.contract.processPayment(batchId, index, signature);
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw new Error('Failed to process payment');
    }
  }

  async getBatchPayment(batchId: string, index: number) {
    if (!this.contract) throw new Error('Not connected to Web3');
    
    try {
      const payment = await this.contract.batchPayments(batchId, index);
      return {
        recipient: payment.recipient,
        amount: ethers.formatUnits(payment.amount, 6), // Convert from USDC decimals
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
    if (!this.contract) throw new Error('Not connected to Web3');
    
    try {
      const count = await this.contract.batchCounts(batchId);
      return Number(count);
    } catch (error) {
      console.error('Error getting batch count:', error);
      throw new Error('Failed to get batch count');
    }
  }
}

export const web3Service = new Web3Service();
