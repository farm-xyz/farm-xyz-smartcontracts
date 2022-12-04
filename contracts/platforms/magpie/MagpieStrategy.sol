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
import "./interfaces/IPoolHelper.sol";
import "./interfaces/IPoolHelper.sol";
// import hardhat console
import "hardhat/console.sol";

contract MagpieStrategy is IXStrategy, OwnableUpgradeable, UUPSUpgradeable {
    uint256 constant MAX_UINT256 = 2 ** 256 - 1;

    string public name;

    IPoolHelper private _magpiePoolHelper;

    IERC20Metadata private _baseToken;

    uint256 private _baseTokenDenominator;

    /**
     * @param baseToken - The base token used for different conversion
     * @param magpiePoolHelper - The magpie pool address
     */
    function initialize(IERC20Metadata baseToken,
                        IPoolHelper magpiePoolHelper) initializer external {
        __UUPSUpgradeable_init();

        name = "MagpieStrategy";

        _magpiePoolHelper = magpiePoolHelper;
        _baseToken = baseToken;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function invest(IERC20Metadata token, uint256 amount, uint256 expectedBaseTokenAmount, int slippage) override external returns (uint256) {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        if (_baseToken.allowance(address(this), address(_magpiePoolHelper.wombatStaking())) < amount) {
            _baseToken.approve(address(_magpiePoolHelper.wombatStaking()), amount);
        }
        console.log("strategy balance before deposit: ", _baseToken.balanceOf(address(this)));
        console.log("helper allowance before deposit: ", _baseToken.allowance(address(this), address(_magpiePoolHelper.wombatStaking())));
        uint256 balanceBefore = _magpiePoolHelper.balance(address(this));
        console.log("lp balance before deposit: ", balanceBefore);
        _magpiePoolHelper.deposit(amount, amount);
        uint256 balanceAfter = _magpiePoolHelper.balance(address(this));
        console.log("lp balance after deposit: ", balanceAfter);
        console.log("strategy balance after deposit: ", _baseToken.balanceOf(address(this)));

        return balanceAfter - balanceBefore;
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
        uint256 balanceBefore = _magpiePoolHelper.balance(address(this));
        _magpiePoolHelper.withdraw(amount, 0);
        uint256 balanceAfter = _magpiePoolHelper.balance(address(this));

        require(_baseToken.transfer(msg.sender, balanceAfter-balanceBefore), "ERC20: transfer failed");
        return balanceAfter-balanceBefore;
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
        console.log("getTotalAssetValue: ", _magpiePoolHelper.balance(address(this)));
        return _magpiePoolHelper.balance(address(this));
    }

    function compound() override external {

    }

}
