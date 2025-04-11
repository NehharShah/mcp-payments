import React, { useState, useEffect, ChangeEvent } from 'react';
import { web3Service } from '../services/web3';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  useToast,
  Text
} from '@chakra-ui/react';

interface TokenSwapProps {
  supportedTokens: Array<{
    address: string;
    symbol: string;
  }>;
}

export const TokenSwap: React.FC<TokenSwapProps> = ({ supportedTokens }) => {
  const [fromToken, setFromToken] = useState('');
  const [toToken, setToToken] = useState('');
  const [amount, setAmount] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [fromBalance, setFromBalance] = useState('0');
  const toast = useToast();

  useEffect(() => {
    if (fromToken) {
      loadBalance();
    }
  }, [fromToken]);

  const loadBalance = async () => {
    try {
      const balance = await web3Service.getTokenBalance(fromToken);
      setFromBalance(balance);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const handleSwap = async () => {
    try {
      setLoading(true);
      await web3Service.swapTokens(
        fromToken,
        toToken,
        amount,
        minAmount
      );
      
      toast({
        title: 'Swap successful',
        description: 'Your tokens have been swapped successfully',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      // Refresh balance
      await loadBalance();
    } catch (error) {
      toast({
        title: 'Swap failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box p={6} borderWidth={1} borderRadius="lg" bg="white" shadow="sm">
      <VStack spacing={4}>
        <Text fontSize="xl" fontWeight="bold" mb={4}>
          Swap Tokens
        </Text>

        <FormControl>
          <FormLabel>From Token</FormLabel>
          <Select
            value={fromToken}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFromToken(e.target.value)}
            placeholder="Select token"
          >
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.address}>
                {token.symbol}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>To Token</FormLabel>
          <Select
            value={toToken}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setToToken(e.target.value)}
            placeholder="Select token"
          >
            {supportedTokens
              .filter((token) => token.address !== fromToken)
              .map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol}
                </option>
              ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Amount</FormLabel>
          <Input
            type="number"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            placeholder="Enter amount"
          />
          <Text fontSize="sm" color="gray.600" mt={1}>
            Balance: {fromBalance}
          </Text>
        </FormControl>

        <FormControl>
          <FormLabel>Minimum Received</FormLabel>
          <Input
            type="number"
            value={minAmount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setMinAmount(e.target.value)}
            placeholder="Enter minimum amount"
          />
        </FormControl>

        <Button
          colorScheme="blue"
          width="full"
          onClick={handleSwap}
          isLoading={loading}
          disabled={!fromToken || !toToken || !amount || !minAmount}
        >
          Swap
        </Button>
      </VStack>
    </Box>
  );
};
