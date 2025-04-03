import axios, { AxiosError } from 'axios';
import { Project, Payment, Contribution } from '../types';
import { web3Service } from '../services/web3';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000';

export const fetchProjects = async (filter: string = 'all'): Promise<Project[]> => {
  try {
    const response = await axios.get(`${API_URL}/api/projects?filter=${filter}`);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to fetch projects: ${err.message}`);
  }
};

export const fetchProject = async (id: string): Promise<Project> => {
  try {
    const response = await axios.get(`${API_URL}/api/projects/${id}`);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to fetch project: ${err.message}`);
  }
};

export const createProject = async (data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
  try {
    const response = await axios.post(`${API_URL}/api/projects`, data);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to create project: ${err.message}`);
  }
};

export const fetchProjectPayments = async (projectId: string): Promise<Payment[]> => {
  try {
    const response = await axios.get(`${API_URL}/api/projects/${projectId}/payments`);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to fetch project payments: ${err.message}`);
  }
};

export const fetchProjectContributions = async (projectId: string): Promise<Contribution[]> => {
  try {
    const response = await axios.get(`${API_URL}/api/projects/${projectId}/contributions`);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to fetch project contributions: ${err.message}`);
  }
};

interface CreatePaymentData {
  amount: string;
  recipient: string;
}

export const createPayment = async (projectId: string, data: CreatePaymentData): Promise<Payment> => {
  try {
    // 1. Connect to Web3
    await web3Service.connect();
    
    // 2. Create batch payment on smart contract
    const batchId = await web3Service.createBatch([data.recipient], [data.amount]);
    
    // 3. Get payment signature from backend
    const response = await axios.post(`${API_URL}/process-payment`, {
      payment_type: 'single',
      amount: parseFloat(data.amount),
      currency: 'USDC',
      recipients: [data.recipient],
      metadata: {
        projectId,
        batchId
      }
    });

    // 4. Process payment on smart contract
    await web3Service.processPayment(
      batchId,
      0, // Index is 0 for single payment
      response.data.signature
    );

    // 5. Return payment details
    const payment = await web3Service.getBatchPayment(batchId, 0);
    return {
      id: batchId,
      amount: payment.amount,
      recipient: payment.recipient,
      timestamp: payment.createdAt.toISOString(),
      status: payment.processed ? 'completed' : 'pending',
      batchId,
      signature: payment.signature
    };
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to create payment: ${err.message}`);
  }
};

export const createContribution = async (projectId: string, data: Omit<Contribution, 'id' | 'timestamp' | 'status'>): Promise<Contribution> => {
  try {
    const response = await axios.post(`${API_URL}/api/projects/${projectId}/contributions`, data);
    return response.data;
  } catch (error) {
    const err = error as AxiosError;
    throw new Error(`Failed to create contribution: ${err.message}`);
  }
};
