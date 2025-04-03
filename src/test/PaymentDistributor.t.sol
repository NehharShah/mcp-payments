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
        // Prepare batch data
        address[] memory recipients = new address[](2);
        recipients[0] = recipient1;
        recipients[1] = recipient2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 100 * 10**6; // 100 USDC
        amounts[1] = 200 * 10**6; // 200 USDC
        
        bytes[] memory signatures = new bytes[](2);
        signatures[0] = _signPayment(recipient1Key, TEST_BATCH_ID, recipient1, amounts[0]);
        signatures[1] = _signPayment(recipient2Key, TEST_BATCH_ID, recipient2, amounts[1]);
        
        // Approve USDC
        usdc.approve(address(distributor), 300 * 10**6);
        
        // Create batch
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
        
        // Verify batch creation
        PaymentDistributor.Payment[] memory payments = _getBatchPayments(TEST_BATCH_ID);
        assertEq(payments.length, 2);
        assertEq(payments[0].recipient, recipient1);
        assertEq(payments[0].amount, 100 * 10**6);
        assertEq(payments[1].recipient, recipient2);
        assertEq(payments[1].amount, 200 * 10**6);
    }
    
    function testFailCreateBatchWithInvalidSignature() public {
        address[] memory recipients = new address[](1);
        recipients[0] = recipient1;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 10**6;
        
        bytes[] memory signatures = new bytes[](1);
        // Sign with wrong key
        signatures[0] = _signPayment(recipient2Key, TEST_BATCH_ID, recipient1, amounts[0]);
        
        usdc.approve(address(distributor), 100 * 10**6);
        
        vm.expectRevert(InvalidSignature.selector);
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
    }
    
    function testProcessBatch() public {
        // Create batch first
        testCreateBatch();
        
        // Process batch
        uint256 recipient1BalanceBefore = usdc.balanceOf(recipient1);
        uint256 recipient2BalanceBefore = usdc.balanceOf(recipient2);
        
        distributor.processBatch(TEST_BATCH_ID);
        
        // Verify payments
        assertEq(usdc.balanceOf(recipient1), recipient1BalanceBefore + 100 * 10**6);
        assertEq(usdc.balanceOf(recipient2), recipient2BalanceBefore + 200 * 10**6);
    }
    
    function testFailProcessExpiredBatch() public {
        // Create batch first
        testCreateBatch();
        
        // Move time forward past timeout
        vm.warp(block.timestamp + 25 hours);
        
        vm.expectRevert();
        distributor.processBatch(TEST_BATCH_ID);
    }
    
    function testDisputePayment() public {
        // Create batch first
        testCreateBatch();
        
        // Dispute as recipient1
        vm.prank(recipient1);
        distributor.disputePayment(TEST_BATCH_ID, 0);
        
        // Try to dispute already processed payment
        distributor.processBatch(TEST_BATCH_ID);
        
        vm.expectRevert(PaymentAlreadyProcessed.selector);
        vm.prank(recipient1);
        distributor.disputePayment(TEST_BATCH_ID, 0);
    }
    
    function testExpireBatch() public {
        // Create batch first
        testCreateBatch();
        
        // Move time forward past timeout
        vm.warp(block.timestamp + 25 hours);
        
        uint256 ownerBalanceBefore = usdc.balanceOf(owner);
        
        distributor.expireBatch(TEST_BATCH_ID);
        
        // Verify unprocessed funds returned to owner
        assertEq(usdc.balanceOf(owner), ownerBalanceBefore + 300 * 10**6);
    }
    
    function testPause() public {
        distributor.pause();
        
        // Try to create batch while paused
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        bytes[] memory signatures = new bytes[](1);
        
        vm.expectRevert("Pausable: paused");
        distributor.createBatch(TEST_BATCH_ID, recipients, amounts, signatures);
        
        // Unpause and verify it works
        distributor.unpause();
        testCreateBatch();
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
    
    function _getBatchPayments(bytes32 batchId) internal view returns (PaymentDistributor.Payment[] memory) {
        return distributor.batchPayments(batchId);
    }
}
