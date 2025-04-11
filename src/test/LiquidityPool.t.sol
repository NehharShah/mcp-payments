// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "forge-std/Test.sol";
import "../LiquidityPool.sol";
import "../StablecoinRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockStablecoin is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**decimals());
    }
}

contract MockPriceFeed is AggregatorV3Interface {
    int256 private _price;
    uint8 private _decimals;
    uint80 private _roundId;

    constructor(int256 price_, uint8 decimals_) {
        _price = price_;
        _decimals = decimals_;
    }

    function setPrice(int256 price_) external {
        _price = price_;
        _roundId++;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function description() external pure override returns (string memory) {
        return "Mock Price Feed";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80) external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (_roundId, _price, block.timestamp, block.timestamp, _roundId);
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (_roundId, _price, block.timestamp, block.timestamp, _roundId);
    }
}

contract LiquidityPoolTest is Test {
    LiquidityPool public pool;
    StablecoinRegistry public registry;
    MockStablecoin public usdc;
    MockStablecoin public usdt;
    MockPriceFeed public usdcPriceFeed;
    MockPriceFeed public usdtPriceFeed;
    address public owner;
    address public user;

    event LiquidityAdded(address indexed token, address indexed provider, uint256 amount);
    event LiquidityRemoved(address indexed token, address indexed provider, uint256 amount);
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 fromAmount,
        uint256 toAmount
    );
    event SwapFeeUpdated(uint256 newFee);

    function setUp() public {
        owner = address(this);
        user = address(0xBEEF);
        
        // Setup stablecoins and price feeds
        usdc = new MockStablecoin("USD Coin", "USDC");
        usdt = new MockStablecoin("Tether", "USDT");
        usdcPriceFeed = new MockPriceFeed(1e8, 8); // $1.00
        usdtPriceFeed = new MockPriceFeed(1e8, 8); // $1.00

        // Setup registry and register stablecoins
        registry = new StablecoinRegistry();
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );
        registry.registerStablecoin(
            address(usdt),
            address(usdtPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        // Setup liquidity pool
        pool = new LiquidityPool(address(registry));
        pool.setSwapFee(30); // 0.3%
        
        // Fund user wallet
        usdc.transfer(user, 10000 * 10**6);
        usdt.transfer(user, 10000 * 10**6);
        
        // Fund pool with initial liquidity
        usdc.transfer(address(pool), 2000 * 10**6);
        usdt.transfer(address(pool), 2000 * 10**6);
        
        // Approve pool for user and owner
        vm.startPrank(user);
        usdc.approve(address(pool), type(uint256).max);
        usdt.approve(address(pool), type(uint256).max);
        vm.stopPrank();
        
        usdc.approve(address(pool), type(uint256).max);
        usdt.approve(address(pool), type(uint256).max);
    }

    function testAddLiquidity() public {
        uint256 amount = 1000 * 10**6;
        
        vm.prank(user);
        pool.addLiquidity(address(usdc), amount);
        
        assertEq(usdc.balanceOf(address(pool)), amount + 2000 * 10**6);
    }

    function testRemoveLiquidity() public {
        uint256 amount = 1000 * 10**6;
        
        vm.startPrank(user);
        pool.removeLiquidity(address(usdc), amount);
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(address(pool)), 1000 * 10**6);
    }

    function testSwap() public {
        uint256 swapAmount = 1000 * 10**6;
        uint256 toAmount = 997 * 10**6; // 0.3% fee
        
        vm.startPrank(user);
        pool.swap(
            address(usdc),
            address(usdt),
            swapAmount,
            toAmount
        );
        vm.stopPrank();
        
        assertEq(usdc.balanceOf(address(pool)), swapAmount + 2000 * 10**6);
        assertEq(usdt.balanceOf(address(pool)), 2000 * 10**6 - toAmount);
    }

    function testSetSwapFee() public {
        uint256 newFee = 50; // 0.5%
        pool.setSwapFee(newFee);
        assertEq(pool.swapFee(), newFee);
    }

    function testPause() public {
        pool.pause();
        assertTrue(pool.paused());
    }

    function testUnpause() public {
        pool.pause();
        pool.unpause();
        assertFalse(pool.paused());
    }

    function test_RevertWhen_AddLiquidityZeroAmount() public {
        vm.expectRevert(InvalidAmount.selector);
        vm.prank(user);
        pool.addLiquidity(address(usdc), 0);
    }

    function test_RevertWhen_RemoveLiquidityInsufficientBalance() public {
        uint256 excessAmount = 3000 * 10**6; // More than pool balance
        
        vm.expectRevert(InsufficientLiquidity.selector);
        vm.prank(user);
        pool.removeLiquidity(address(usdc), excessAmount);
    }

    function test_RevertWhen_SwapInsufficientLiquidity() public {
        uint256 excessAmount = 3000 * 10**6; // More than pool balance
        uint256 minAmount = 2900 * 10**6; // Reasonable slippage
        
        vm.expectRevert(InsufficientLiquidity.selector);
        vm.prank(user);
        pool.swap(
            address(usdc),
            address(usdt),
            excessAmount,
            minAmount
        );
    }

    function test_RevertWhen_SwapExcessiveSlippage() public {
        uint256 swapAmount = 1000 * 10**6;
        uint256 minAmount = 1000 * 10**6; // No slippage allowed
        
        vm.expectRevert(ExcessiveSlippage.selector);
        vm.prank(user);
        pool.swap(
            address(usdc),
            address(usdt),
            swapAmount,
            minAmount
        );
    }

    function test_RevertWhen_SetSwapFeeNotOwner() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        pool.setSwapFee(50);
    }

    function test_RevertWhen_SetSwapFeeTooHigh() public {
        vm.expectRevert(InvalidFee.selector);
        pool.setSwapFee(101); // > 1%
    }

    function testRescueFunds() public {
        uint256 amount = 1000 * 10**6;
        address recipient = address(0xCAFE); // Different address than user
        
        // Initial balance should be 2000 * 10**6
        uint256 initialBalance = usdc.balanceOf(address(pool));
        assertEq(initialBalance, 2000 * 10**6, "Initial balance incorrect");
        
        pool.rescueFunds(address(usdc), recipient, amount);
        
        assertEq(usdc.balanceOf(address(pool)), initialBalance - amount, "Final pool balance incorrect");
        assertEq(usdc.balanceOf(recipient), amount, "Recipient balance incorrect");
    }

    function test_RevertWhen_RescueFundsNotOwner() public {
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        pool.rescueFunds(address(usdc), user, 1000 * 10**6);
    }
}
