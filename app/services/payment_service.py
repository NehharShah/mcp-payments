from typing import List, Dict, Any
from datetime import datetime
from web3 import Web3
from eth_account import Account
from sqlalchemy.orm import Session
from app.models.database import Payment, User, Project
from app.core.mcp import PaymentType
import json

class PaymentService:
    def __init__(self, db: Session, web3_provider: str, distributor_address: str, liquidity_pool_address: str):
        self.db = db
        self.w3 = Web3(Web3.HTTPProvider(web3_provider))
        self.distributor_address = distributor_address
        self.liquidity_pool_address = liquidity_pool_address
        
    def create_batch_payment(
        self,
        project_id: int,
        payment_type: PaymentType,
        distributions: Dict[str, float],
        currency: str
    ) -> str:
        """Create a batch payment transaction"""
        batch_id = self.w3.keccak(text=f"{project_id}-{datetime.utcnow().timestamp()}").hex()
        
        # Create payment records
        payments = []
        for address, amount in distributions.items():
            payment = Payment(
                project_id=project_id,
                recipient_id=self._get_user_id(address),
                amount=amount,
                currency=currency,
                payment_type=payment_type,
                status="pending",
                tx_hash=""
            )
            payments.append(payment)
            self.db.add(payment)
        
        self.db.commit()
        
        # Prepare contract call
        recipients = [p.recipient.address for p in payments]
        amounts = [self.w3.to_wei(p.amount, 'ether') for p in payments]
        
        # Build transaction
        contract = self.get_distributor_contract()
        tx = contract.functions.createBatch(
            batch_id,
            recipients,
            amounts
        ).build_transaction({
            'from': self.w3.eth.default_account,
            'gas': 2000000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(self.w3.eth.default_account)
        })
        
        # Sign and send transaction
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key='your_private_key')
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        # Update payment records with tx_hash
        for payment in payments:
            payment.tx_hash = tx_hash.hex()
        self.db.commit()
        
        return batch_id
    
    def process_batch_payment(self, batch_id: str) -> Dict[str, Any]:
        """Process a batch payment"""
        # Call contract to process batch
        contract = self.get_distributor_contract()
        tx = contract.functions.processBatch(batch_id).build_transaction({
            'from': self.w3.eth.default_account,
            'gas': 2000000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(self.w3.eth.default_account)
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, private_key='your_private_key')
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        # Wait for transaction receipt
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Update payment statuses
        if receipt['status'] == 1:
            payments = self.db.query(Payment).filter(Payment.tx_hash == tx_hash.hex()).all()
            for payment in payments:
                payment.status = "completed"
            self.db.commit()
            
            return {
                "status": "success",
                "batch_id": batch_id,
                "tx_hash": tx_hash.hex(),
                "payments_processed": len(payments)
            }
        else:
            return {
                "status": "failed",
                "batch_id": batch_id,
                "tx_hash": tx_hash.hex(),
                "error": "Transaction failed"
            }
    
    def get_payment_history(self, user_id: int = None, project_id: int = None) -> List[Dict]:
        """Get payment history with optional filters"""
        query = self.db.query(Payment)
        
        if user_id:
            query = query.filter(Payment.recipient_id == user_id)
        if project_id:
            query = query.filter(Payment.project_id == project_id)
            
        payments = query.order_by(Payment.created_at.desc()).all()
        
        return [
            {
                "id": p.id,
                "recipient": p.recipient.username,
                "amount": p.amount,
                "currency": p.currency,
                "payment_type": p.payment_type,
                "status": p.status,
                "tx_hash": p.tx_hash,
                "created_at": p.created_at.isoformat()
            }
            for p in payments
        ]
    
    def get_distributor_contract(self):
        with open('contracts/PaymentDistributor.json') as f:
            contract_json = json.load(f)
        return self.w3.eth.contract(
            address=self.distributor_address,
            abi=contract_json['abi']
        )
    
    def get_liquidity_pool_contract(self):
        with open('contracts/LiquidityPool.json') as f:
            contract_json = json.load(f)
        return self.w3.eth.contract(
            address=self.liquidity_pool_address,
            abi=contract_json['abi']
        )
    
    def _get_user_id(self, address: str) -> int:
        """Get or create user by Ethereum address"""
        user = self.db.query(User).filter(User.address == address).first()
        if not user:
            user = User(address=address)
            self.db.add(user)
            self.db.commit()
        return user.id
