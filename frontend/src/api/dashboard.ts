import axios from 'axios';
import { UserStats, Activity } from '../types';

/// <reference types="vite/client" />

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

export const fetchUserStats = async (address: string): Promise<UserStats> => {
    const response = await axios.get(`${API_URL}/api/users/${address}/stats`);
    return response.data;
};

export const fetchRecentActivity = async (address: string): Promise<Activity[]> => {
    const response = await axios.get(`${API_URL}/api/users/${address}/activity`);
    return response.data;
};

export async function fetchContributionData(account: string, timeframe: string) {
  // Mock data generation
  const now = new Date();
  const data = [];
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 100)
    });
  }

  return data;
}
