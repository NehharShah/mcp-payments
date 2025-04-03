export interface UserStats {
  totalContributions: number;
  totalPayments: number;
  activeProjects: number;
  pendingPayments: number;
}

export interface Activity {
  id: string;
  type: 'payment' | 'contribution' | 'project';
  description: string;
  timestamp: string;
  amount?: string;
  projectName?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
  status: 'active' | 'completed' | 'cancelled';
  totalPaid: string;
  contributorsCount: number;
  contributionScore: number;
}

export interface Payment {
  id: string;
  amount: string;
  recipient: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed';
  batchId: string;
  signature: string;
}

export interface Contribution {
  id: string;
  description: string;
  contributor: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

declare global {
  interface Window {
    ethereum: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      selectedAddress: string | null;
      on: (event: string, callback: (accounts: string[]) => void) => void;
      removeListener: (event: string, callback: (accounts: string[]) => void) => void;
    }
  }
}
