// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "forge-std/Test.sol";
import "../StablecoinRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract MockStablecoin is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**decimals());
    }
}

contract MockPriceFeed is AggregatorV3Interface {
    int256 private _price;
    uint8 private _decimals;
    uint80 private _roundId;
    uint256 private _lastUpdateTime;

    constructor(int256 price_, uint8 decimals_) {
        _price = price_;
        _decimals = decimals_;
        _roundId = 1;
        _lastUpdateTime = block.timestamp;
    }

    function setPrice(int256 price_) external {
        _price = price_;
        _roundId++;
    }

    function setLastUpdateTime(uint256 time) external {
        if (time > block.timestamp) revert();
        _lastUpdateTime = time;
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
        return (_roundId, _price, _lastUpdateTime, _lastUpdateTime, _roundId);
    }

    function latestRoundData() external view override returns (uint80, int256, uint256, uint256, uint80) {
        return (_roundId, _price, _lastUpdateTime, _lastUpdateTime, _roundId);
    }
}

contract StablecoinRegistryTest is Test {
    StablecoinRegistry public registry;
    MockStablecoin public usdc;
    MockStablecoin public usdt;
    MockPriceFeed public usdcPriceFeed;
    MockPriceFeed public usdtPriceFeed;
    address public owner;

    event StablecoinRegistered(address indexed token, address priceFeed);
    event StablecoinDeregistered(address indexed token);
    event PriceFeedUpdated(address indexed token, address newPriceFeed);
    event MinLiquidityUpdated(address indexed token, uint256 newMinLiquidity);
    event MaxSlippageUpdated(address indexed token, uint256 newMaxSlippage);

    function setUp() public {
        owner = address(this);
        registry = new StablecoinRegistry();
        
        usdc = new MockStablecoin("USD Coin", "USDC");
        usdt = new MockStablecoin("Tether", "USDT");
        
        usdcPriceFeed = new MockPriceFeed(1e8, 8); // $1.00 with 8 decimals
        usdtPriceFeed = new MockPriceFeed(1e8, 8); // $1.00 with 8 decimals
    }

    function testRegisterStablecoin() public {
        vm.expectEmit(true, true, false, true);
        emit StablecoinRegistered(address(usdc), address(usdcPriceFeed));
        
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6, // 1000 USDC min liquidity
            50 // 0.5% max slippage
        );

        (bool isRegistered, address priceFeed, uint8 decimals, uint256 minLiquidity, uint256 maxSlippage) = 
            registry.stablecoins(address(usdc));
        
        assertTrue(isRegistered);
        assertEq(priceFeed, address(usdcPriceFeed));
        assertEq(decimals, 6);
        assertEq(minLiquidity, 1000 * 10**6);
        assertEq(maxSlippage, 50);
    }

    function test_RevertWhen_RegisterInvalidStablecoin() public {
        vm.expectRevert(InvalidStablecoin.selector);
        registry.registerStablecoin(
            address(0),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );
    }

    function test_RevertWhen_RegisterInvalidPriceFeed() public {
        vm.expectRevert(InvalidPriceFeed.selector);
        registry.registerStablecoin(
            address(usdc),
            address(0),
            6,
            1000 * 10**6,
            50
        );
    }

    function test_RevertWhen_RegisterDuplicate() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        vm.expectRevert(StablecoinAlreadyRegistered.selector);
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );
    }

    function testDeregisterStablecoin() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        vm.expectEmit(true, false, false, true);
        emit StablecoinDeregistered(address(usdc));
        registry.deregisterStablecoin(address(usdc));

        (bool isRegistered,,,,) = registry.stablecoins(address(usdc));
        assertFalse(isRegistered);
    }

    function testUpdatePriceFeed() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        MockPriceFeed newPriceFeed = new MockPriceFeed(1e8, 8);
        
        vm.expectEmit(true, false, false, true);
        emit PriceFeedUpdated(address(usdc), address(newPriceFeed));
        registry.updatePriceFeed(address(usdc), address(newPriceFeed));

        (,address priceFeed,,,) = registry.stablecoins(address(usdc));
        assertEq(priceFeed, address(newPriceFeed));
    }

    function testGetStablecoinPrice() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        uint256 price = registry.getStablecoinPrice(address(usdc));
        assertEq(price, 1e8); // $1.00
    }

    function test_RevertWhen_GetPriceUnregistered() public {
        vm.expectRevert(StablecoinNotRegistered.selector);
        registry.getStablecoinPrice(address(usdc));
    }

    function test_RevertWhen_GetPriceStale() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        // Move time forward beyond staleness threshold
        vm.warp(block.timestamp + 2 hours);
        
        vm.expectRevert(PriceStale.selector);
        registry.getStablecoinPrice(address(usdc));
    }

    function testValidateStablecoin() public {
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        // Transfer required minimum liquidity
        usdc.transfer(address(registry), 1000 * 10**6);
        
        // Should not revert
        registry.validateStablecoin(address(usdc));
    }

    function test_RevertWhen_ValidateInsufficientLiquidity() public {
        address testContract = address(0xBEEF);
        
        registry.registerStablecoin(
            address(usdc),
            address(usdcPriceFeed),
            6,
            1000 * 10**6,
            50
        );

        vm.expectRevert(InvalidStablecoin.selector);
        vm.prank(testContract);
        registry.validateStablecoin(address(usdc));
    }
}
