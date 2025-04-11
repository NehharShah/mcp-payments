// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

error InvalidSignature();
error BatchAlreadyExists();
error BatchNotFound();
error BatchExpired(bytes32 batchId);
error InvalidBatchSize();
error SignatureAlreadyUsed();
error TransferFailed();
error InvalidRecipient();
error PaymentAlreadyProcessed();
error UnauthorizedDispute();
error BatchTimedOut(bytes32 batchId);
error BatchNotExpired(bytes32 batchId);
error InvalidBatchInputs();

contract PaymentDistributor is Ownable, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    IERC20 public immutable stablecoin;
    uint256 public constant BATCH_TIMEOUT = 24 hours;
    uint256 public constant MAX_BATCH_SIZE = 100;
    
    struct Payment {
        address recipient;
        uint256 amount;
        bool processed;
        uint256 createdAt;
        bytes signature;
    }
    
    mapping(bytes32 => mapping(uint256 => Payment)) public batchPayments;
    mapping(bytes32 => uint256) public batchCounts;
    mapping(address => uint256) public totalPaid;
    mapping(bytes32 => bool) public usedSignatures;
    
    event BatchCreatedEvent(bytes32 indexed batchId);
    event BatchCompletedEvent(bytes32 indexed batchId, uint256 totalAmount);
    event BatchExpiredEvent(bytes32 indexed batchId);
    event PaymentProcessedEvent(
        bytes32 indexed batchId,
        address indexed recipient,
        uint256 amount,
        bytes signature
    );
    event PaymentDisputedEvent(bytes32 indexed batchId, address indexed recipient);
    event BatchTimedOutEvent(bytes32 indexed batchId);
    
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
        if (recipients.length == 0 || recipients.length > MAX_BATCH_SIZE) revert InvalidBatchSize();
        if (recipients.length != amounts.length || recipients.length != signatures.length)
            revert InvalidBatchInputs();
        if (batchCounts[batchId] > 0) revert BatchAlreadyExists();
        
        uint256 totalAmount;
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert InvalidRecipient();
            if (signatures[i].length != 65) revert InvalidSignature();
            if (!_verifyPayment(batchId, recipients[i], amounts[i], signatures[i])) {
                revert InvalidSignature();
            }
            
            totalAmount += amounts[i];

            batchPayments[batchId][i] = Payment({
                recipient: recipients[i],
                amount: amounts[i],
                processed: false,
                createdAt: block.timestamp,
                signature: signatures[i]
            });
        }
        
        batchCounts[batchId] = recipients.length;
        
        if (!stablecoin.transferFrom(msg.sender, address(this), totalAmount)) {
            revert TransferFailed();
        }
        
        emit BatchCreatedEvent(batchId);
    }
    
    function processBatch(bytes32 batchId) external nonReentrant whenNotPaused {
        uint256 count = batchCounts[batchId];
        if (count == 0) revert BatchNotFound();

        bool hasExpired = false;
        for (uint256 i = 0; i < count; i++) {
            Payment storage payment = batchPayments[batchId][i];
            if (block.timestamp > payment.createdAt + BATCH_TIMEOUT) {
                hasExpired = true;
                break;
            }
        }
        if (!hasExpired) revert BatchNotExpired(batchId);

        uint256 totalProcessed = 0;
        
        for (uint256 i = 0; i < count; i++) {
            Payment storage payment = batchPayments[batchId][i];
            if (!payment.processed) {
                if (!stablecoin.transfer(payment.recipient, payment.amount)) {
                    revert TransferFailed();
                }
                
                payment.processed = true;
                totalPaid[payment.recipient] += payment.amount;
                totalProcessed += payment.amount;
                
                emit PaymentProcessedEvent(batchId, payment.recipient, payment.amount, payment.signature);
            }
        }
        
        if (totalProcessed > 0) {
            emit BatchCompletedEvent(batchId, totalProcessed);
        }
    }
    
    function disputePayment(bytes32 batchId, uint256 paymentIndex) external {
        uint256 count = batchCounts[batchId];
        if (paymentIndex >= count) revert BatchNotFound();
        
        Payment storage payment = batchPayments[batchId][paymentIndex];
        if (msg.sender != payment.recipient) revert UnauthorizedDispute();
        if (payment.processed) revert PaymentAlreadyProcessed();
        
        emit PaymentDisputedEvent(batchId, msg.sender);
    }
    
    function expireBatch(bytes32 batchId) external {
        uint256 count = batchCounts[batchId];
        if (count == 0) revert BatchNotFound();
        
        Payment storage firstPayment = batchPayments[batchId][0];
        if (block.timestamp < firstPayment.createdAt + BATCH_TIMEOUT) {
            revert BatchNotExpired(batchId);
        }
        
        uint256 unprocessedAmount = 0;
        for (uint256 i = 0; i < count; i++) {
            Payment storage payment = batchPayments[batchId][i];
            if (!payment.processed) {
                unprocessedAmount += payment.amount;
            }
        }
        
        if (unprocessedAmount > 0) {
            if (!stablecoin.transfer(owner(), unprocessedAmount)) {
                revert TransferFailed();
            }
            emit BatchExpiredEvent(batchId);
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
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(batchId, recipient, amount))
            )
        );
        address signer = ECDSA.recover(messageHash, signature);
        return signer == recipient;
    }
}
