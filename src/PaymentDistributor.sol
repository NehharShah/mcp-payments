// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error InvalidSignature();
error BatchAlreadyExists();
error BatchNotFound();
error BatchExpired();
error InvalidBatchSize();
error SignatureAlreadyUsed();
error TransferFailed();
error InvalidRecipient();
error PaymentAlreadyProcessed();
error UnauthorizedDispute();

contract PaymentDistributor is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    IERC20 public immutable stablecoin;
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
        if (_stablecoin == address(0)) revert InvalidRecipient();
        stablecoin = IERC20(_stablecoin);
    }
    
    function createBatch(
        bytes32 batchId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes[] calldata signatures
    ) external whenNotPaused onlyOwner {
        if (recipients.length != amounts.length) revert InvalidBatchSize();
        if (recipients.length != signatures.length) revert InvalidBatchSize();
        if (recipients.length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        if (batchPayments[batchId].length > 0) revert BatchAlreadyExists();
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipient();
            bytes32 sigHash = keccak256(signatures[i]);
            if (usedSignatures[sigHash]) revert SignatureAlreadyUsed();
            if (!_verifyPayment(batchId, recipients[i], amounts[i], signatures[i])) {
                revert InvalidSignature();
            }
            
            usedSignatures[sigHash] = true;
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
        
        if (!stablecoin.transferFrom(msg.sender, address(this), totalAmount)) {
            revert TransferFailed();
        }
    }
    
    function processBatch(bytes32 batchId) external nonReentrant whenNotPaused {
        Payment[] storage payments = batchPayments[batchId];
        if (payments.length == 0) revert BatchNotFound();
        
        uint256 totalProcessed = 0;
        
        for (uint256 i = 0; i < payments.length; i++) {
            Payment storage payment = payments[i];
            if (!payment.processed && block.timestamp <= payment.timestamp + BATCH_TIMEOUT) {
                if (!stablecoin.transfer(payment.recipient, payment.amount)) {
                    revert TransferFailed();
                }
                
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
        if (paymentIndex >= payments.length) revert BatchNotFound();
        
        Payment storage payment = payments[paymentIndex];
        if (msg.sender != payment.recipient) revert UnauthorizedDispute();
        if (payment.processed) revert PaymentAlreadyProcessed();
        
        emit PaymentDisputed(batchId, msg.sender);
    }
    
    function expireBatch(bytes32 batchId) external {
        Payment[] storage payments = batchPayments[batchId];
        if (payments.length == 0) revert BatchNotFound();
        if (block.timestamp <= payments[0].timestamp + BATCH_TIMEOUT) revert BatchExpired();
        
        uint256 unprocessedAmount = 0;
        for (uint256 i = 0; i < payments.length; i++) {
            if (!payments[i].processed) {
                unprocessedAmount += payments[i].amount;
            }
        }
        
        if (unprocessedAmount > 0) {
            if (!stablecoin.transfer(owner(), unprocessedAmount)) {
                revert TransferFailed();
            }
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
        return ethSignedMessageHash.recover(signature) == recipient;
    }
}
