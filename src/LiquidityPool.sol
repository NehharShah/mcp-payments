// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./StablecoinRegistry.sol";

error InsufficientLiquidity();
error ExcessiveSlippage();
error SwapFailed();
error InvalidAmount();
error InvalidFee();

/// @title Liquidity Pool for Stablecoin Swaps
/// @notice Manages liquidity and facilitates swaps between supported stablecoins
/// @dev Integrates with StablecoinRegistry for price feeds and token validation
contract LiquidityPool is Ownable, ReentrancyGuard, Pausable {
    /// @notice Reference to the StablecoinRegistry contract
    StablecoinRegistry public immutable registry;
    
    /// @notice Fee denominator for swap calculations (10000 = 100%)
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    /// @notice Current swap fee in basis points (e.g., 30 = 0.3%)
    uint256 public swapFee;
    
    /// @notice Emitted when liquidity is added to the pool
    /// @param token Address of the token being added
    /// @param provider Address of the provider adding liquidity
    /// @param amount Amount of token being added
    event LiquidityAdded(
        address indexed token,
        address indexed provider,
        uint256 amount
    );
    
    /// @notice Emitted when liquidity is removed from the pool
    /// @param token Address of the token being removed
    /// @param provider Address of the provider removing liquidity
    /// @param amount Amount of token being removed
    event LiquidityRemoved(
        address indexed token,
        address indexed provider,
        uint256 amount
    );
    
    /// @notice Emitted when a swap is executed
    /// @param fromToken Address of the token being swapped from
    /// @param toToken Address of the token being swapped to
    /// @param user Address of the user executing the swap
    /// @param fromAmount Amount of fromToken being swapped
    /// @param toAmount Amount of toToken received
    event SwapExecuted(
        address indexed fromToken,
        address indexed toToken,
        address indexed user,
        uint256 fromAmount,
        uint256 toAmount
    );
    
    /// @notice Initializes the liquidity pool with a reference to the registry
    /// @param _registry Address of the StablecoinRegistry contract
    constructor(address _registry) {
        registry = StablecoinRegistry(_registry);
    }
    
    /// @notice Adds liquidity to the pool
    /// @dev Only callable when the contract is not paused
    /// @param token Address of the token being added
    /// @param amount Amount of token being added
    function addLiquidity(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        
        // Validate stablecoin
        registry.validateStablecoin(token);
        
        // Transfer tokens to pool
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        emit LiquidityAdded(token, msg.sender, amount);
    }
    
    /// @notice Removes liquidity from the pool
    /// @dev Only callable when the contract is not paused
    /// @param token Address of the token being removed
    /// @param amount Amount of token being removed
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
    
    /// @notice Executes a swap between two supported stablecoins
    /// @dev Uses Chainlink price feeds for price calculation and includes slippage protection
    /// @param fromToken Address of the token to swap from
    /// @param toToken Address of the token to swap to
    /// @param fromAmount Amount of fromToken to swap
    /// @param minToAmount Minimum amount of toToken to receive (slippage protection)
    /// @return Amount of toToken received from the swap
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
    
    /// @notice Updates the swap fee
    /// @dev Only callable by the contract owner
    /// @param newFee New swap fee in basis points (must be less than FEE_DENOMINATOR)
    function setSwapFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high"); // Max 1%
        swapFee = newFee;
    }
    
    /// @notice Pauses the contract
    /// @dev Only callable by the contract owner
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Unpauses the contract
    /// @dev Only callable by the contract owner
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /// @notice Rescues funds from the contract
    /// @dev Only callable by the contract owner
    /// @param token Address of the token to rescue
    /// @param to Address to send the rescued funds to
    /// @param amount Amount of token to rescue
    function rescueFunds(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}
