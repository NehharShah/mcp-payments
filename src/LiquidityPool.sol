// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./StablecoinRegistry.sol";

error InsufficientLiquidity();
error ExcessiveSlippage();
error InvalidAmount();
error SwapFailed();

contract LiquidityPool is Ownable, ReentrancyGuard, Pausable {
    StablecoinRegistry public immutable registry;
    
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public swapFee = 30; // 0.3%
    
    event LiquidityAdded(
        address indexed token,
        address indexed provider,
        uint256 amount
    );
    
    event LiquidityRemoved(
        address indexed token,
        address indexed provider,
        uint256 amount
    );
    
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 fromAmount,
        uint256 toAmount
    );
    
    constructor(address _registry) {
        registry = StablecoinRegistry(_registry);
    }
    
    function addLiquidity(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        // Validate stablecoin
        registry.validateStablecoin(token);
        
        // Transfer tokens to pool
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        emit LiquidityAdded(token, msg.sender, amount);
    }
    
    function removeLiquidity(
        address token,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        // Validate stablecoin and check liquidity
        registry.validateStablecoin(token);
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) revert InsufficientLiquidity();
        
        // Transfer tokens back to provider
        IERC20(token).transfer(msg.sender, amount);
        
        emit LiquidityRemoved(token, msg.sender, amount);
    }
    
    function swap(
        address fromToken,
        address toToken,
        uint256 fromAmount,
        uint256 minToAmount
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (fromAmount == 0) revert InvalidAmount();
        if (fromToken == toToken) revert InvalidAmount();
        
        // Validate both stablecoins
        registry.validateStablecoin(fromToken);
        registry.validateStablecoin(toToken);
        
        // Calculate swap amount based on price feeds
        uint256 fromPrice = registry.getStablecoinPrice(fromToken);
        uint256 toPrice = registry.getStablecoinPrice(toToken);
        uint8 fromDecimals = registry.getStablecoinDecimals(fromToken);
        uint8 toDecimals = registry.getStablecoinDecimals(toToken);
        
        // Calculate output amount with fee
        uint256 toAmount = (fromAmount * fromPrice * (FEE_DENOMINATOR - swapFee) * (10**toDecimals)) / 
                          (toPrice * FEE_DENOMINATOR * (10**fromDecimals));
        
        // Check slippage
        if (toAmount < minToAmount) revert ExcessiveSlippage();
        
        // Check liquidity
        uint256 toBalance = IERC20(toToken).balanceOf(address(this));
        if (toAmount > toBalance) revert InsufficientLiquidity();
        
        // Execute swap
        if (!IERC20(fromToken).transferFrom(msg.sender, address(this), fromAmount)) {
            revert SwapFailed();
        }
        if (!IERC20(toToken).transfer(msg.sender, toAmount)) {
            revert SwapFailed();
        }
        
        emit SwapExecuted(fromToken, toToken, msg.sender, fromAmount, toAmount);
        return toAmount;
    }
    
    function setSwapFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high"); // Max 1%
        swapFee = newFee;
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function rescueFunds(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
