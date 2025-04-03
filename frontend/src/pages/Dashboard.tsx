import { useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import { useQuery } from '@tanstack/react-query';
import { Web3Provider } from '@ethersproject/providers';
import { fetchUserStats, fetchRecentActivity } from '../api/dashboard';
import StatsCard from '../components/StatsCard';
import ActivityFeed from '../components/ActivityFeed';
import ContributionChart from '../components/ContributionChart';

export default function Dashboard() {
  const { account, isActive } = useWeb3React<Web3Provider>();
  const [timeframe, setTimeframe] = useState('30d');

  const { data: stats } = useQuery({
    queryKey: ['userStats', account],
    queryFn: () => fetchUserStats(account as string),
    enabled: !!account
  });

  const { data: activity } = useQuery({
    queryKey: ['recentActivity', account],
    queryFn: () => fetchRecentActivity(account as string),
    enabled: !!account
  });

  if (!isActive) {
    return (
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-900">Welcome to MCP Payment</h2>
        <p className="mt-4 text-lg text-gray-600">
          Please connect your wallet to view your dashboard
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of your contributions and payments
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          title="Total Payments"
          value={stats?.totalPayments.toString() || '0'}
          subtext="All time"
        />
        <StatsCard
          title="Total Contributions"
          value={stats?.totalContributions.toString() || '0'}
          subtext="All time"
        />
        <StatsCard
          title="Active Projects"
          value={stats?.activeProjects.toString() || '0'}
          subtext="Current"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900">Contribution Activity</h3>
          <ContributionChart timeframe={timeframe} data={[]} />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          <ActivityFeed activities={activity || []} />
        </div>
      </div>
    </div>
  );
}
