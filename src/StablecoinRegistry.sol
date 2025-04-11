// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

error InvalidStablecoin();
error StablecoinAlreadyRegistered();
error StablecoinNotRegistered();
error InvalidPriceFeed();
error PriceStale();

contract StablecoinRegistry is Ownable, ReentrancyGuard {
    struct StablecoinInfo {
        bool isRegistered;
        address priceFeed;
        uint8 decimals;
        uint256 minLiquidity;
        uint256 maxSlippage;
    }

    mapping(address => StablecoinInfo) public stablecoins;
    address[] public supportedStablecoins;
    
    uint256 public constant PRICE_STALENESS_THRESHOLD = 1 hours;
    uint256 public constant MAX_SLIPPAGE_BPS = 100; // 1%
    
    event StablecoinRegistered(address indexed token, address priceFeed);
    event StablecoinDeregistered(address indexed token);
    event PriceFeedUpdated(address indexed token, address newPriceFeed);
    event MinLiquidityUpdated(address indexed token, uint256 newMinLiquidity);
    event MaxSlippageUpdated(address indexed token, uint256 newMaxSlippage);
    
    constructor() {}
    
    function registerStablecoin(
        address token,
        address priceFeed,
        uint8 decimals,
        uint256 minLiquidity,
        uint256 maxSlippage
    ) external onlyOwner {
        if (token == address(0)) revert InvalidStablecoin();
        if (priceFeed == address(0)) revert InvalidPriceFeed();
        if (stablecoins[token].isRegistered) revert StablecoinAlreadyRegistered();
        if (maxSlippage > MAX_SLIPPAGE_BPS) revert InvalidStablecoin();
        
        stablecoins[token] = StablecoinInfo({
            isRegistered: true,
            priceFeed: priceFeed,
            decimals: decimals,
            minLiquidity: minLiquidity,
            maxSlippage: maxSlippage
        });
        
        supportedStablecoins.push(token);
        emit StablecoinRegistered(token, priceFeed);
    }
    
    function deregisterStablecoin(address token) external onlyOwner {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        
        delete stablecoins[token];
        
        // Remove from supported stablecoins array
        for (uint i = 0; i < supportedStablecoins.length; i++) {
            if (supportedStablecoins[i] == token) {
                supportedStablecoins[i] = supportedStablecoins[supportedStablecoins.length - 1];
                supportedStablecoins.pop();
                break;
            }
        }
        
        emit StablecoinDeregistered(token);
    }
    
    function updatePriceFeed(address token, address newPriceFeed) external onlyOwner {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        if (newPriceFeed == address(0)) revert InvalidPriceFeed();
        
        stablecoins[token].priceFeed = newPriceFeed;
        emit PriceFeedUpdated(token, newPriceFeed);
    }
    
    function updateMinLiquidity(address token, uint256 newMinLiquidity) external onlyOwner {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        
        stablecoins[token].minLiquidity = newMinLiquidity;
        emit MinLiquidityUpdated(token, newMinLiquidity);
    }
    
    function updateMaxSlippage(address token, uint256 newMaxSlippage) external onlyOwner {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        if (newMaxSlippage > MAX_SLIPPAGE_BPS) revert InvalidStablecoin();
        
        stablecoins[token].maxSlippage = newMaxSlippage;
        emit MaxSlippageUpdated(token, newMaxSlippage);
    }
    
    function getStablecoinPrice(address token) public view returns (uint256) {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(stablecoins[token].priceFeed);
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        if (price <= 0) revert InvalidPriceFeed();
        if (answeredInRound < roundId) revert InvalidPriceFeed();
        if (block.timestamp - updatedAt > PRICE_STALENESS_THRESHOLD) revert PriceStale();
        
        return uint256(price);
    }
    
    function getStablecoinDecimals(address token) external view returns (uint8) {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        return stablecoins[token].decimals;
    }
    
    function getSupportedStablecoins() external view returns (address[] memory) {
        return supportedStablecoins;
    }
    
    function validateStablecoin(address token) external view {
        if (!stablecoins[token].isRegistered) revert StablecoinNotRegistered();
        
        // Check minimum liquidity
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < stablecoins[token].minLiquidity) revert InvalidStablecoin();
        
        // Check price feed is active
        getStablecoinPrice(token);
    }
}
