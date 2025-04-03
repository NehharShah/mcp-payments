import { ethers, ContractRunner, Log, BrowserProvider } from 'ethers';

export type EthereumProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, handler: (...args: any[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: any[]) => void) => void;
  selectedAddress: string | null;
  isMetaMask?: boolean;
};

const PAYMENT_DISTRIBUTOR_ADDRESS = import.meta.env.VITE_PAYMENT_DISTRIBUTOR_ADDRESS as string;
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
  private contract: ethers.Contract | null = null;

  async connect() {
    if (typeof window.ethereum !== 'undefined') {
      const ethereum = window.ethereum as unknown as EthereumProvider;
      await ethereum.request({ method: 'eth_requestAccounts' });
      
      // Initialize provider using BrowserProvider
      this.provider = new ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();
      this.contract = new ethers.Contract(
        PAYMENT_DISTRIBUTOR_ADDRESS,
        PAYMENT_DISTRIBUTOR_ABI,
        this.signer
      );
    } else {
      throw new Error('Please install MetaMask!');
    }
  }

  async createBatch(recipients: string[], amounts: string[]) {
    if (!this.contract) throw new Error('Not connected to Web3');
    
    const tx = await this.contract.createBatch(
      recipients,
      amounts.map(amount => ethers.parseUnits(amount, 6)) // Assuming USDC with 6 decimals
    );
    const receipt = await tx.wait();
    
    const batchCreatedEvent = receipt.logs?.find(
      (log: Log) => {
        try {
          const parsedLog = this.contract?.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsedLog?.name === 'BatchCreatedEvent';
        } catch {
          return false;
        }
      }
    );
    
    if (!batchCreatedEvent || !this.contract) throw new Error('Batch creation failed');
    const parsedLog = this.contract.interface.parseLog({
      topics: batchCreatedEvent.topics,
      data: batchCreatedEvent.data
    });
    if (!parsedLog) throw new Error('Failed to parse event log');
    return parsedLog.args.batchId;
  }

  async processPayment(batchId: string, index: number, signature: string) {
    if (!this.contract) throw new Error('Not connected to Web3');
    
    const tx = await this.contract.processPayment(batchId, index, signature);
    await tx.wait();
  }

  async getBatchPayment(batchId: string, index: number) {
    if (!this.contract) throw new Error('Not connected to Web3');
    
    const payment = await this.contract.batchPayments(batchId, index);
    return {
      recipient: payment.recipient,
      amount: ethers.formatUnits(payment.amount, 6),
      processed: payment.processed,
      createdAt: new Date(Number(payment.createdAt) * 1000),
      signature: payment.signature
    };
  }

  async getBatchCount(batchId: string) {
    if (!this.contract) throw new Error('Not connected to Web3');
    return Number(await this.contract.batchCounts(batchId));
  }
}

export const web3Service = new Web3Service();
