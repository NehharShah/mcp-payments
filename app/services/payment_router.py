from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from web3 import Web3
import networkx as nx
from eth_typing import ChecksumAddress
from app.core.payment_processor import PaymentProcessor

@dataclass
class Route:
    path: List[ChecksumAddress]
    amounts: List[int]
    total_fee: int
    estimated_gas: int

class PaymentRouter:
    def __init__(self, web3: Web3, registry_address: ChecksumAddress, pool_address: ChecksumAddress):
        self.web3 = web3
        self.registry = self.web3.eth.contract(
            address=registry_address,
            abi=self._load_abi("StablecoinRegistry")
        )
        self.pool = self.web3.eth.contract(
            address=pool_address,
            abi=self._load_abi("LiquidityPool")
        )
        self.graph = nx.DiGraph()
        self._build_graph()

    def _load_abi(self, contract_name: str) -> List[Dict]:
        """Load contract ABI from build artifacts"""
        import json
        with open(f'out/{contract_name}.sol/{contract_name}.json', 'r') as f:
            return json.load(f)['abi']

    def _build_graph(self):
        """Build a directed graph of stablecoin liquidity pools"""
        self.graph.clear()
        
        # Get all supported stablecoins
        stablecoins = self.registry.functions.getSupportedStablecoins().call()
        
        # Add nodes and edges for each valid pair
        for from_token in stablecoins:
            for to_token in stablecoins:
                if from_token != to_token:
                    try:
                        # Check if there's sufficient liquidity
                        balance = self.pool.functions.getBalance(to_token).call()
                        min_liquidity = self.registry.functions.getMinLiquidity(to_token).call()
                        
                        if balance >= min_liquidity:
                            # Get prices for fee calculation
                            from_price = self.registry.functions.getStablecoinPrice(from_token).call()
                            to_price = self.registry.functions.getStablecoinPrice(to_token).call()
                            
                            # Add edge with weight based on price ratio and fees
                            self.graph.add_edge(
                                from_token,
                                to_token,
                                weight=from_price/to_price,
                                fee=self.pool.functions.swapFee().call()
                            )
                    except Exception:
                        continue

    def find_best_route(
        self,
        from_token: ChecksumAddress,
        to_token: ChecksumAddress,
        amount: int,
        max_hops: int = 3
    ) -> Optional[Route]:
        """Find the best route for swapping from one stablecoin to another"""
        self._build_graph()  # Refresh graph state
        
        if from_token == to_token:
            return Route(
                path=[from_token],
                amounts=[amount],
                total_fee=0,
                estimated_gas=21000  # Base transfer cost
            )
        
        try:
            # Find all simple paths within max_hops
            paths = list(nx.all_simple_paths(self.graph, from_token, to_token, cutoff=max_hops))
            
            if not paths:
                return None
                
            best_route = None
            min_total_fee = float('inf')
            
            for path in paths:
                amounts = [amount]
                total_fee = 0
                estimated_gas = 21000  # Base cost
                
                # Calculate amounts and fees along the path
                for i in range(len(path) - 1):
                    edge = self.graph[path[i]][path[i+1]]
                    fee = (amounts[-1] * edge['fee']) // 10000
                    total_fee += fee
                    
                    # Calculate output amount after fee
                    output_amount = (amounts[-1] - fee) * edge['weight']
                    amounts.append(int(output_amount))
                    
                    # Add gas cost for swap
                    estimated_gas += 100000  # Approximate swap cost
                
                if total_fee < min_total_fee:
                    best_route = Route(
                        path=path,
                        amounts=amounts,
                        total_fee=total_fee,
                        estimated_gas=estimated_gas
                    )
                    min_total_fee = total_fee
            
            return best_route
            
        except Exception as e:
            print(f"Error finding route: {str(e)}")
            return None

    async def execute_route(
        self,
        route: Route,
        sender: ChecksumAddress,
        recipient: ChecksumAddress
    ) -> List[str]:
        """Execute a payment route"""
        tx_hashes = []
        
        try:
            current_holder = sender
            
            # Execute swaps along the route
            for i in range(len(route.path) - 1):
                from_token = route.path[i]
                to_token = route.path[i + 1]
                from_amount = route.amounts[i]
                to_amount = route.amounts[i + 1]
                
                # Calculate minimum output with 1% slippage tolerance
                min_to_amount = (to_amount * 99) // 100
                
                # Execute swap
                tx = await self.pool.functions.swap(
                    from_token,
                    to_token,
                    from_amount,
                    min_to_amount
                ).transact({
                    'from': current_holder,
                    'gas': 200000
                })
                
                tx_hashes.append(tx.hex())
                current_holder = self.pool.address
            
            # Final transfer to recipient
            final_token = route.path[-1]
            final_amount = route.amounts[-1]
            
            token_contract = self.web3.eth.contract(
                address=final_token,
                abi=self._load_abi("IERC20")
            )
            
            tx = await token_contract.functions.transfer(
                recipient,
                final_amount
            ).transact({
                'from': current_holder,
                'gas': 100000
            })
            
            tx_hashes.append(tx.hex())
            
            return tx_hashes
            
        except Exception as e:
            print(f"Error executing route: {str(e)}")
            raise
