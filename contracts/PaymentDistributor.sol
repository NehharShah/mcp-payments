// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract PaymentDistributor is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    IERC20 public stablecoin;
    uint256 public constant BATCH_TIMEOUT = 24 hours;
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    struct Payment {
        address recipient;
        uint256 amount;
        bool processed;
        uint256 timestamp;
        bytes signature;
    }
    
    mapping(bytes32 => Payment[]) public batchPayments;
    mapping(address => uint256) public totalPaid;
    mapping(bytes32 => bool) public usedSignatures;
    
    event PaymentProcessed(
        bytes32 indexed batchId,
        address indexed recipient,
        uint256 amount,
        bytes signature
    );
    
    event BatchCompleted(bytes32 indexed batchId, uint256 totalAmount);
    event BatchExpired(bytes32 indexed batchId);
    event PaymentDisputed(bytes32 indexed batchId, address indexed recipient);
    
    constructor(address _stablecoin) {
        stablecoin = IERC20(_stablecoin);
    }
    
    function createBatch(
        bytes32 batchId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes[] calldata signatures
    ) external whenNotPaused onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length == signatures.length, "Signature length mismatch");
        require(recipients.length <= MAX_BATCH_SIZE, "Batch too large");
        require(batchPayments[batchId].length == 0, "Batch exists");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(!usedSignatures[keccak256(signatures[i])], "Signature already used");
            require(_verifyPayment(batchId, recipients[i], amounts[i], signatures[i]), "Invalid signature");
            
            usedSignatures[keccak256(signatures[i])] = true;
            batchPayments[batchId].push(
                Payment({
                    recipient: recipients[i],
                    amount: amounts[i],
                    processed: false,
                    timestamp: block.timestamp,
                    signature: signatures[i]
                })
            );
            totalAmount += amounts[i];
        }
        
        require(
            stablecoin.transferFrom(msg.sender, address(this), totalAmount),
            "Transfer failed"
        );
    }
    
    function processBatch(bytes32 batchId) external nonReentrant whenNotPaused {
        Payment[] storage payments = batchPayments[batchId];
        require(payments.length > 0, "Batch not found");
        
        uint256 totalProcessed = 0;
        
        for (uint256 i = 0; i < payments.length; i++) {
            Payment storage payment = payments[i];
            if (!payment.processed && block.timestamp <= payment.timestamp + BATCH_TIMEOUT) {
                require(
                    stablecoin.transfer(payment.recipient, payment.amount),
                    "Transfer failed"
                );
                
                payment.processed = true;
                totalPaid[payment.recipient] += payment.amount;
                totalProcessed += payment.amount;
                
                emit PaymentProcessed(batchId, payment.recipient, payment.amount, payment.signature);
            }
        }
        
        if (totalProcessed > 0) {
            emit BatchCompleted(batchId, totalProcessed);
        }
    }
    
    function disputePayment(bytes32 batchId, uint256 paymentIndex) external {
        Payment[] storage payments = batchPayments[batchId];
        require(paymentIndex < payments.length, "Invalid payment index");
        Payment storage payment = payments[paymentIndex];
        require(msg.sender == payment.recipient, "Not recipient");
        require(!payment.processed, "Already processed");
        
        emit PaymentDisputed(batchId, msg.sender);
    }
    
    function expireBatch(bytes32 batchId) external {
        Payment[] storage payments = batchPayments[batchId];
        require(payments.length > 0, "Batch not found");
        require(block.timestamp > payments[0].timestamp + BATCH_TIMEOUT, "Batch not expired");
        
        uint256 unprocessedAmount = 0;
        for (uint256 i = 0; i < payments.length; i++) {
            if (!payments[i].processed) {
                unprocessedAmount += payments[i].amount;
            }
        }
        
        if (unprocessedAmount > 0) {
            require(
                stablecoin.transfer(owner(), unprocessedAmount),
                "Transfer failed"
            );
            emit BatchExpired(batchId);
        }
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function _verifyPayment(
        bytes32 batchId,
        address recipient,
        uint256 amount,
        bytes memory signature
    ) internal pure returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(batchId, recipient, amount)
        );
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        return signer == recipient;
    }
}
