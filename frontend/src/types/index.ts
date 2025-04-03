export interface User {
    id: number;
    address: string;
    username: string;
    reputation_score: number;
}

export interface Project {
    id: number;
    name: string;
    github_url: string;
    description: string;
    total_paid: number;
    contributors_count: number;
    contribution_score: number;
}

export interface Contribution {
    id: number;
    type: string;
    value: number;
    data: any;
    created_at: string;
    user: User;
}

export interface Payment {
    id: number;
    recipient: User;
    amount: number;
    currency: string;
    payment_type: string;
    status: string;
    tx_hash: string;
    created_at: string;
}

export interface UserStats {
    totalEarned: number;
    totalContributions: number;
    reputationScore: number;
    earningsTrend: number;
    contributionsTrend: number;
    reputationTrend: number;
    contributionHistory: Array<{
        date: string;
        value: number;
    }>;
}

export interface Activity {
    id: number;
    type: 'contribution' | 'payment' | 'milestone';
    title: string;
    description: string;
    amount?: number;
    currency?: string;
    created_at: string;
}
