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
  Text,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel
} from '@chakra-ui/react';

interface LiquidityManagementProps {
  supportedTokens: Array<{
    address: string;
    symbol: string;
  }>;
}

export const LiquidityManagement: React.FC<LiquidityManagementProps> = ({ supportedTokens }) => {
  const [selectedToken, setSelectedToken] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState('0');
  const toast = useToast();

  useEffect(() => {
    if (selectedToken) {
      loadBalance();
    }
  }, [selectedToken]);

  const loadBalance = async () => {
    try {
      const balance = await web3Service.getTokenBalance(selectedToken);
      setBalance(balance);
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const handleAddLiquidity = async () => {
    try {
      setLoading(true);
      await web3Service.addLiquidity(selectedToken, amount);
      
      toast({
        title: 'Liquidity added',
        description: 'Successfully added liquidity to the pool',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      await loadBalance();
    } catch (error) {
      toast({
        title: 'Failed to add liquidity',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    try {
      setLoading(true);
      await web3Service.removeLiquidity(selectedToken, amount);
      
      toast({
        title: 'Liquidity removed',
        description: 'Successfully removed liquidity from the pool',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
      
      await loadBalance();
    } catch (error) {
      toast({
        title: 'Failed to remove liquidity',
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
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        Manage Liquidity
      </Text>

      <Tabs isFitted variant="enclosed">
        <TabList mb="1em">
          <Tab>Add Liquidity</Tab>
          <Tab>Remove Liquidity</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Token</FormLabel>
                <Select
                  value={selectedToken}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedToken(e.target.value)}
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
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                />
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Balance: {balance}
                </Text>
              </FormControl>

              <Button
                colorScheme="blue"
                width="full"
                onClick={handleAddLiquidity}
                isLoading={loading}
                isDisabled={!selectedToken || !amount}
              >
                Add Liquidity
              </Button>
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Token</FormLabel>
                <Select
                  value={selectedToken}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSelectedToken(e.target.value)}
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
                <FormLabel>Amount</FormLabel>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                />
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Balance: {balance}
                </Text>
              </FormControl>

              <Button
                colorScheme="red"
                width="full"
                onClick={handleRemoveLiquidity}
                isLoading={loading}
                isDisabled={!selectedToken || !amount}
              >
                Remove Liquidity
              </Button>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};
