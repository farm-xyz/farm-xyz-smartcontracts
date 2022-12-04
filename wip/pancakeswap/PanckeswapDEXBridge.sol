pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../../bridges/IXPlatformBridge.sol";
import "./IPancakeRouter02.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract PancakeswapDEXBridge is IXPlatformBridge, OwnableUpgradeable, UUPSUpgradeable {

    IPancakeRouter02 private _router;

    string public name;

    /**
     */
    function initialize() initializer external {
        __UUPSUpgradeable_init();

        name = "PancakeswapDEXBridge";
        _router = IPancakeRouter02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // get current price of token in a pair
    function getPrice(IERC20Metadata token, IERC20Metadata baseToken) view override public returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = address(baseToken);
        uint256[] memory amounts = _router.getAmountsOut(1e18, path);
        return amounts[1];
    }

    // Swap a token to another token on Pancakeswap
    // without knowing the price
    function swap(IERC20Metadata fromToken, IERC20Metadata toToken, uint256 amount, int slippage) override external returns (uint256) {
        require(fromToken.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        if (fromToken.allowance(address(this), address(_router)) < amount) {
            fromToken.approve(address(_router), amount);
        }
        address[] memory path = new address[](2);
        path[0] = address(fromToken);
        path[1] = address(toToken);
        uint256[] memory amounts = _router.swapExactTokensForTokens(amount, 0, path, msg.sender, block.timestamp);
        return amounts[1];
    }

    // add liquidity to Pancakeswap
    function addLiquidity(IERC20Metadata tokenA, IERC20Metadata tokenB, uint256 amountA, uint256 amountB, int slippage) override external returns (uint256) {
        require(tokenA.transferFrom(msg.sender, address(this), amountA), "ERC20: transferFrom failed");
        require(tokenB.transferFrom(msg.sender, address(this), amountB), "ERC20: transferFrom failed");
        if (tokenA.allowance(address(this), address(_router)) < amountA) {
            tokenA.approve(address(_router), amountA);
        }
        if (tokenB.allowance(address(this), address(_router)) < amountB) {
            tokenB.approve(address(_router), amountB);
        }
        uint256[] memory amounts = _router.addLiquidity(address(tokenA), address(tokenB), amountA, amountB, 0, 0, msg.sender, block.timestamp);
        return amounts[0];
    }



}
