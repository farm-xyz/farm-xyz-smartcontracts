// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXStrategy.sol";
import "../bridges/IXPlatformBridge.sol";
import "../contracts/IXAsset.sol";

// todo: we'll have multiple strategy types: LPStrategy, LPFarmStrategy, FarmStrategy, MultifarmStrategy, etc.
contract FarmStrategy is IXStrategy, Ownable {

    string public name = "FarmStrategy";

    IXPlatformBridge private bridge;

    IERC20 private farm;
    IERC20Metadata private baseToken;

    mapping(address => uint256) private totalVirtualAssets;

    /**
     * @param _bridge - The strategy used to manage actions between investment assets
     * @param _farm - The farm used for investing
     * @param _baseToken - The base token used for different conversion
     */
    constructor(IXPlatformBridge _bridge,
        IERC20 _farm,
        IERC20Metadata _baseToken) {
        // todo: add xAsset, pool param, add baseToken, assets to convert to

        bridge = _bridge;
        farm = _farm;
        baseToken = _baseToken;
    }

    // invest(token, amount, slippage) -> returns the amount invested in baseTokens
    //  -> uses PlatformBridge to find amount of tokens to convert to based on the target pool
    //  -> uses DexBridge to convert token amount into target tokens, with the specific slippage
    //  -> stake converted assets to pool
    //  -> returns baseToken amount invested
    function invest(IERC20Metadata token, uint256 amount, int slippage) override external returns (uint256) {
        return 0;
    }

    // withdraw(amount, toToken, amount?, slippage?) ->
    //    -> autocompound --- maybe v2
    //    -> calculates the right amount of assets to convert for the amount of baseTokens
    //    -> withdraw from liquidity pool/farm/etc
    //    -> covert to toToken, check if amount is in slippage range
    //    -> return the number of baseToken converted so the xAsset should burn the shares
    function withdraw(uint256 amount, IERC20Metadata toToken, int slippage) override external returns (uint256) {
        return 0;
    }

    function convert(IERC20Metadata token, uint256 amount) view override public returns (uint256) {
        console.log('[convert]', amount, address(token));
        // TODO: handle conversion between token & assets

        return amount;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return 0;
    }

    /**
     * @return The total value of the virtually invested assets
     */
    function getTotalVirtualAssetValue() override view external returns (uint256) {
        return 1000;
    }

    /**
     * @dev Virtually invest some tokens in the pool/farm, returns the total amount of baseTokens "invested"
     */
    function virtualInvest(uint256 amount) override view external returns (uint256) {
        return 1000;
    }
}
