// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../PaymentDistributor.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1000000 * 10**6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract PaymentDistributorTest is Test {
    PaymentDistributor public distributor;
    MockUSDC public usdc;
    
    address public owner;
    address public recipient1;
    address public recipient2;
    address public recipient3;
    uint256 public recipient1Key;
    uint256 public recipient2Key;
    uint256 public recipient3Key;
    
    bytes32 public constant TEST_BATCH_ID = bytes32(uint256(1));
    
    function setUp() public {
        owner = address(this);
        (recipient1, recipient1Key) = makeAddrAndKey("recipient1");
        (recipient2, recipient2Key) = makeAddrAndKey("recipient2");
        (recipient3, recipient3Key) = makeAddrAndKey("recipient3");
        
        usdc = new MockUSDC();
        distributor = new PaymentDistributor(address(usdc));
    }
    
    function testInitialState() public {
        assertEq(address(distributor.stablecoin()), address(usdc));
        assertEq(distributor.owner(), owner);
        assertEq(distributor.BATCH_TIMEOUT(), 24 hours);
        assertEq(distributor.MAX_BATCH_SIZE(), 100);
    }
    
    function testCreateBatch() public {
        // Create signatures
        bytes32 messageHash1 = keccak256(abi.encodePacked(TEST_BATCH_ID, recipient1, uint256(100 * 10**6)));
        bytes32 ethSignedHash1 = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash1));
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(recipient1Key, ethSignedHash1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        bytes32 messageHash2 = keccak256(abi.encodePacked(TEST_BATCH_ID, recipient2, uint256(200 * 10**6)));
        bytes32 ethSignedHash2 = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash2));
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(recipient2Key, ethSignedHash2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);
        
        // Approve tokens
        usdc.approve(address(distributor), 300 * 10**6);
        
        // Create batch
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 10**6;
        amounts[1] = 200 * 10**6;
        
        bytes[] memory signatures = new bytes[](2);
        signatures[0] = signature1;
        signatures[1] = signature2;
        
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
        
        // Verify batch was created correctly
        assertEq(distributor.batchCounts(TEST_BATCH_ID), 2);
        
        (address recipient, uint256 amount, bool processed, uint256 createdAt, bytes memory signature) = distributor.batchPayments(TEST_BATCH_ID, 0);
        assertEq(recipient, recipient1);
        assertEq(amount, 100 * 10**6);
        assertFalse(processed);
        assertGt(createdAt, 0);
        assertEq(signature, signature1);
        
        (recipient, amount, processed, createdAt, signature) = distributor.batchPayments(TEST_BATCH_ID, 1);
        assertEq(recipient, recipient2);
        assertEq(amount, 200 * 10**6);
        assertFalse(processed);
        assertGt(createdAt, 0);
        assertEq(signature, signature2);
    }
    
    function test_RevertWhen_CreateBatchWithInvalidSignature() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10**6;
        
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = "invalid";
        
        vm.expectRevert(InvalidSignature.selector);
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
    }
    
    function createTestBatch() internal {
        // Create signatures
        bytes32 messageHash1 = keccak256(abi.encodePacked(TEST_BATCH_ID, recipient1, uint256(100 * 10**6)));
        bytes32 ethSignedHash1 = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash1));
        (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(recipient1Key, ethSignedHash1);
        bytes memory signature1 = abi.encodePacked(r1, s1, v1);
        
        bytes32 messageHash2 = keccak256(abi.encodePacked(TEST_BATCH_ID, recipient2, uint256(200 * 10**6)));
        bytes32 ethSignedHash2 = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash2));
        (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(recipient2Key, ethSignedHash2);
        bytes memory signature2 = abi.encodePacked(r2, s2, v2);
        
        // Approve tokens
        usdc.approve(address(distributor), 300 * 10**6);
        
        // Create batch
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 10**6;
        amounts[1] = 200 * 10**6;
        
        bytes[] memory signatures = new bytes[](2);
        signatures[0] = signature1;
        signatures[1] = signature2;
        
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
    }

    function testProcessBatch() public {
        // Create batch
        createTestBatch();

        // Wait for batch to expire
        vm.warp(block.timestamp + distributor.BATCH_TIMEOUT() + 1);

        // Process batch
        distributor.processBatch(TEST_BATCH_ID);

        // Verify payments were processed
        (,, bool processed1,,) = distributor.batchPayments(TEST_BATCH_ID, 0);
        assertTrue(processed1);
        (,, bool processed2,,) = distributor.batchPayments(TEST_BATCH_ID, 1);
        assertTrue(processed2);

        // Verify balances
        assertEq(usdc.balanceOf(recipient1), 100 * 10**6);
        assertEq(usdc.balanceOf(recipient2), 200 * 10**6);
    }

    function test_RevertWhen_ProcessExpiredBatch() public {
        // Create batch
        createTestBatch();

        // Try to process before expiration
        vm.expectRevert(abi.encodeWithSelector(BatchNotExpired.selector, TEST_BATCH_ID));
        distributor.processBatch(TEST_BATCH_ID);
    }
    
    function testDisputePayment() public {
        // Create batch first
        createTestBatch();
        
        // Dispute first payment
        vm.prank(recipient1);
        distributor.disputePayment(TEST_BATCH_ID, 0);
    }
    
    function testExpireBatch() public {
        // Create batch first
        createTestBatch();
        
        // Move time forward past expiration
        vm.warp(block.timestamp + distributor.BATCH_TIMEOUT() + 1);

        // Get initial balance
        uint256 ownerBalanceBefore = usdc.balanceOf(address(this));
        
        // Expire batch
        distributor.expireBatch(TEST_BATCH_ID);
        
        // Verify unprocessed funds were returned
        assertEq(usdc.balanceOf(address(this)), ownerBalanceBefore + 300 * 10**6);
    }
    
    function testPause() public {
        // Pause contract
        distributor.pause();
        assertTrue(distributor.paused());
        
        // Create batch parameters
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10**6;
        
        bytes[] memory signatures = new bytes[](1);
        signatures[0] = "signature";
        
        // Attempt to create batch while paused
        vm.expectRevert("Pausable: paused");
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
        
        // Unpause and verify it works
        distributor.unpause();
        assertFalse(distributor.paused());
    }
    
    function _signPayment(
        uint256 privateKey,
        bytes32 batchId,
        address recipient,
        uint256 amount
    ) internal pure returns (bytes memory) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(batchId, recipient, amount)
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedMessageHash);
        return abi.encodePacked(r, s, v);
    }
    
    function _getBatchPayments(bytes32 batchId) internal view returns (PaymentDistributor.Payment[] memory payments) {
        uint256 length = 0;
        for (uint256 i = 0; i < 100; i++) {
            try distributor.batchPayments(batchId, i) returns (
                address,
                uint256,
                bool,
                uint256,
                bytes memory
            ) {
                length++;
            } catch {
                break;
            }
        }
        
        payments = new PaymentDistributor.Payment[](length);
        for (uint256 i = 0; i < length; i++) {
            (
                address recipient,
                uint256 amount,
                bool processed,
                uint256 createdAt,
                bytes memory signature
            ) = distributor.batchPayments(batchId, i);
            payments[i] = PaymentDistributor.Payment({
                recipient: recipient,
                amount: amount,
                processed: processed,
                createdAt: createdAt,
                signature: signature
            });
        }
    }
}
