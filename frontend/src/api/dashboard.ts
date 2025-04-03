import axios from 'axios';
import { UserStats, Activity } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const fetchUserStats = async (address: string): Promise<UserStats> => {
    const response = await axios.get(`${API_URL}/api/users/${address}/stats`);
    return response.data;
};

export const fetchRecentActivity = async (address: string): Promise<Activity[]> => {
    const response = await axios.get(`${API_URL}/api/users/${address}/activity`);
    return response.data;
};
