// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../strategies/IXStrategy.sol";
import "../../bridges/IXPlatformBridge.sol";
import "../../xassets/IXAsset.sol";
import "./IPancakeRouter02.sol";
import "./PanckeswapDEXBridge.sol";
import "./interfaces/ICakePool.sol";
import "./libraries/PancakeLibrary.sol";

contract PancakeswapStrategy is IXStrategy, OwnableUpgradeable, UUPSUpgradeable {
    uint256 constant MAX_UINT256 = 2 ** 256 - 1;

    string public name;

    IPancakeRouter02 private _router;
    ICakePool private _pool;

    IERC20Metadata private _baseToken;
    IERC20Metadata private _tokenA;
    IERC20Metadata private _tokenB;
    IERC20Metadata private _cakeToken;

    uint256 private _baseTokenDenominator;

    /**
     * @param bridge - The strategy used to manage actions between investment assets
     * @param farm - The farm used for investing
     * @param baseToken - The base token used for different conversion
     */
    function initialize(IERC20Metadata baseToken,
                        IERC20Metadata tokenA,
                        IERC20Metadata tokenB,
                        IERC20Metadata cakeToken) initializer external {
        __UUPSUpgradeable_init();

        name = "PancakeswapStrategy";

        _router = IPancakeRouter02(0x10ED43C718714eb63d5aA57B78B54704E256024E);
        _pool = ICakePool(0x45c54210128a065de780C4B0Df3d16664f7f859e);
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        _tokenA = token0;
        _tokenB = token1;
        _cakeToken = cakeToken;
        _baseToken = baseToken;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function invest(IERC20Metadata token, uint256 amount, uint256 expectedBaseTokenAmount, int slippage) override external returns (uint256) {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        if (_baseToken.allowance(address(this), address(_router)) < amount) {
            _baseToken.approve(address(_router), amount);
        }
//        _bridge.swap(_baseToken)

        return amount;
    }

    // calculate the amount of baseToken we need to convert to each of the tokens based on the balances in the pool
//    function _calculateTokenAmounts(uint256 baseTokenAmount) private view returns (uint256, uint256) {
//        // get conversion rates of both tokens to baseToken
//        uint256 tokenARate = _getPrice(_tokenA);
//        uint256 tokenBRate = _getPrice(_tokenB);
//
//        // calculate the amount of each token we need to convert to by getting the reserve levels
//        (uint reserveA, uint reserveB) = PancakeLibrary.getReserves(address(_router), address(_tokenA), address(_tokenB));
//
//    }

    function withdraw(uint256 amount, IERC20Metadata toToken, int slippage) override external returns (uint256) {
        _router.unstake(amount);
        require(_baseToken.transfer(msg.sender, amount), "ERC20: transfer failed");
        return amount;
    }

    function convert(IERC20Metadata token, uint256 amount) view override public returns (uint256) {
        if (token==_baseToken) {
            return amount;
        }
        revert("Convert not supported yet");
        return 0;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return _router.getUserBalance(address(this));
    }

    function compound() override external {
//        _router.compoundYield();
    }


//    // get current price of token in a pair
//    function _getPrice(IERC20Metadata token) view override private returns (uint256) {
//        address[] memory path = new address[](2);
//        path[0] = address(token);
//        path[1] = address(baseToken);
//        uint256[] memory amounts = _router.getAmountsOut(_baseTokenDenominator, path);
//        return amounts[1];
//    }
//
//    // Swap a token to another token on Pancakeswap
//    // without knowing the price
//    function _swap(IERC20Metadata fromToken, IERC20Metadata toToken, uint256 amount, int slippage) private returns (uint256) {
//        require(fromToken.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
//        if (fromToken.allowance(address(this), address(_router)) < amount) {
//            fromToken.approve(address(_router), amount);
//        }
//        address[] memory path = new address[](2);
//        path[0] = address(fromToken);
//        path[1] = address(toToken);
//        uint256[] memory amounts = _router.swapExactTokensForTokens(amount, 0, path, msg.sender, block.timestamp);
//        return amounts[1];
//    }
//
//    // add liquidity to Pancakeswap
//    function _addLiquidity(IERC20Metadata tokenA, IERC20Metadata tokenB, uint256 amountA, uint256 amountB, int slippage) private returns (uint256) {
//        require(tokenA.transferFrom(msg.sender, address(this), amountA), "ERC20: transferFrom failed");
//        require(tokenB.transferFrom(msg.sender, address(this), amountB), "ERC20: transferFrom failed");
//        if (tokenA.allowance(address(this), address(_router)) < amountA) {
//            tokenA.approve(address(_router), amountA);
//        }
//        if (tokenB.allowance(address(this), address(_router)) < amountB) {
//            tokenB.approve(address(_router), amountB);
//        }
//        uint256[] memory amounts = _router.addLiquidity(address(tokenA), address(tokenB), amountA, amountB, 0, 0, msg.sender, block.timestamp);
//        return amounts[0];
//    }

}
