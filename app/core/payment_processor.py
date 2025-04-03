from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
from eth_typing import ChecksumAddress
from dotenv import load_dotenv
import os
import json

# Load environment variables
load_dotenv()

class PaymentProcessor:
    def __init__(self):
        self.web3 = Web3(Web3.HTTPProvider(os.getenv('WEB3_PROVIDER_URL', 'http://localhost:8545')))
        self.private_key = os.getenv('SIGNER_PRIVATE_KEY')
        self.account = Account.from_key(self.private_key)
        
        # Load contract ABI from out directory
        with open('out/PaymentDistributor.sol/PaymentDistributor.json', 'r') as f:
            contract_json = json.load(f)
            self.contract_abi = contract_json['abi']
        
        # Convert contract address to checksum format
        contract_address = os.getenv('PAYMENT_DISTRIBUTOR_ADDRESS')
        if not contract_address:
            raise ValueError("PAYMENT_DISTRIBUTOR_ADDRESS not set in environment")
        self.contract_address = Web3.to_checksum_address(contract_address)
        
        self.contract = self.web3.eth.contract(
            address=self.contract_address,
            abi=self.contract_abi
        )

    def create_batch(self, recipients: list[str], amounts: list[int]) -> str:
        """Create a new batch payment"""
        # Convert addresses to checksum format
        recipients = [Web3.to_checksum_address(addr) for addr in recipients]
        
        # Create batch on contract
        tx = self.contract.functions.createBatch(recipients, amounts).build_transaction({
            'from': self.account.address,
            'gas': 2000000,
            'gasPrice': self.web3.eth.gas_price,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
        })
        
        # Sign and send transaction
        signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Get batch ID from event
        batch_created_event = self.contract.events.BatchCreatedEvent().process_receipt(receipt)[0]
        return batch_created_event.args.batchId.hex()

    def sign_payment(self, batch_id: str, index: int, recipient: ChecksumAddress, amount: int) -> str:
        """Sign a payment for processing"""
        # Get payment details from contract
        payment = self.contract.functions.batchPayments(batch_id, index).call()
        
        # Verify payment details
        if payment[0].lower() != recipient.lower():
            raise ValueError("Recipient mismatch")
        if payment[1] != amount:
            raise ValueError("Amount mismatch")
        if payment[2]:
            raise ValueError("Payment already processed")
            
        # Create and sign message
        message = self.web3.solidity_keccak(
            ['bytes32', 'uint256', 'address', 'uint256'],
            [batch_id, index, recipient, amount]
        )
        signed_message = Account.sign_message(encode_defunct(message), self.private_key)
        return signed_message.signature.hex()

    def process_payment(self, batch_id: str, index: int, signature: str) -> dict:
        """Process a payment with signature"""
        tx = self.contract.functions.processPayment(batch_id, index, signature).build_transaction({
            'from': self.account.address,
            'gas': 2000000,
            'gasPrice': self.web3.eth.gas_price,
            'nonce': self.web3.eth.get_transaction_count(self.account.address),
        })
        
        signed_tx = self.web3.eth.account.sign_transaction(tx, self.private_key)
        tx_hash = self.web3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
        
        return {
            'status': 'success',
            'transaction_hash': tx_hash.hex(),
            'block_number': receipt.blockNumber
        }
