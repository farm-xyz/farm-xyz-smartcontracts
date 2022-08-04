// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXStrategy.sol";
import "../bridges/IXBridge.sol";

// todo: we'll have multiple strategy types: LPStrategy, LPFarmStrategy, FarmStrategy, MultifarmStrategy, etc.
contract FarmXYZStrategy is IXStrategy, Ownable {

    string public name = "FarmXYZStrategy";
    IXBridge private bridge;

    /**
     * @param _bridge - The strategy used to manage actions between investment assets
     */
    constructor(IXBridge _bridge) {// todo: add xAsset, pool param, add baseToken, assets to convert to
        bridge = _bridge;
    }

    // invest(token, amount, slippage) -> returns the amount invested in baseTokens
    //  -> uses PlatformBridge to find amount of tokens to convert to based on the target pool
    //  -> uses DexBridge to convert token amount into target tokens, with the specific slippage
    //  -> stake converted assets to pool
    //  -> returns baseToken amount invested

    // withdraw(baseToken amount, toToken, amount?, slippage?) ->
    //    -> autocompound --- maybe v2
    //    -> calculates the right amount of assets to convert for the amount of baseTokens
    //    -> withdraw from liquidity pool/farm/etc
    //    -> covert to toToken, check if amount is in slippage range
    //    -> return the number of baseToken converted so the xAsset should burn the shares

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset


    function convert(uint256 amount, address token) override public returns (uint256) {
        console.log('[convert]', amount, token);
        // TODO: handle conversion between token & assets

        return amount;
    }
}
