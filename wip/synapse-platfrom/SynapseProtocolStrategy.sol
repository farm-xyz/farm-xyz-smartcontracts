// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "../../bridges/IXPlatformBridge.sol";
import "../../xassets/IXAsset.sol";
import "../../strategies/IXStrategy.sol";
import "../../farms/FarmXYZBase.sol";
import "./ISynapsePool.sol";

// todo: we'll have multiple strategy types: LPStrategy, LPFarmStrategy, FarmStrategy, MultifarmStrategy, etc.
contract SynapseProtocolStrategy is IXStrategy, OwnableUpgradeable, UUPSUpgradeable {

    address constant SYNAPSE_POOL_ADDRESS = 0x85fCD7Dd0a1e1A9FCD5FD886ED522dE8221C3EE5;

    ISynapsePool private _synapsePool;
    uint16 private _synapsePoolTokensCount;

    string public name;

    IXPlatformBridge private _bridge;

    IERC20Metadata private _baseToken;

    /**
     * The denominator for the base token
     */
    uint256 private _baseTokenDenominator;

    uint256 private _totalValueLocked;

    uint256 private _virtualSharesInvestmentStartTime;
    uint256 private _virtualSharesInvestmentShares;
    uint256 private _virtualSharesInvestmentStartPrice;

    uint8 private _baseTokenIndex;



    /**
     * @param bridge_ - The strategy used to manage actions between investment assets
     * @param farm_ - The farm used for investing
     * @param baseToken_ - The base token used for different conversion
     */
    /**
     */
    function initialize(IXPlatformBridge bridge_,
        IERC20Metadata baseToken_) initializer external {
        console.log("---- [SynapseProtocolStrategy.initialize]");
        __UUPSUpgradeable_init();
        __Ownable_init();

        name = "SynapseProtocolStrategy";
        // todo: add xAsset, pool param, add baseToken, assets to convert to

        _bridge = bridge_;
        _baseToken = baseToken_;
        _baseTokenDenominator = 10 ** uint256(_baseToken.decimals());
        _synapsePool = ISynapsePool(SYNAPSE_POOL_ADDRESS);
        uint256[] memory tokenAmounts = _synapsePool.calculateRemoveLiquidity(1000000000000000000);
        _synapsePoolTokensCount = uint16(tokenAmounts.length);
        console.log("Synapse pool tokens count %s", tokenAmounts.length);
        _baseTokenIndex = _synapsePool.getTokenIndex(address(_baseToken));
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // invest(token, amount, slippage) -> returns the amount invested in baseTokens
    //  -> uses PlatformBridge to find amount of tokens to convert to based on the target pool
    //  -> uses DexBridge to convert token amount into target tokens, with the specific slippage
    //  -> stake converted assets to pool
    //  -> returns baseToken amount invested
    function invest(IERC20Metadata token, uint256 amount, uint256 expectedBaseTokenAmount, int slippage) override external returns (uint256) {
        _totalValueLocked += amount;
        return amount;
    }

    // withdraw(amount, toToken, amount?, slippage?) ->
    //    -> autocompound --- maybe v2
    //    -> calculates the right amount of assets to convert for the amount of baseTokens
    //    -> withdraw from liquidity pool/farm/etc
    //    -> covert to toToken, check if amount is in slippage range
    //    -> return the number of baseToken converted so the xAsset should burn the shares
    function withdraw(uint256 amount, IERC20Metadata toToken, int slippage) override external returns (uint256) {
        console.log('----- [SynapseProtocolStrategy:withdraw] tvl %s amount %s', _totalValueLocked /1 ether, amount/1 ether);
        _totalValueLocked -= amount;
        return amount;
    }

    function convert(IERC20Metadata token, uint256 amount) view override public returns (uint256) {
        console.log('---- [SynapseProtocolStrategy:convert]', amount/1 ether, address(token));
        // TODO: handle conversion between token & assets

        return amount;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return _totalValueLocked;
    }

    function compound() override external
    {
        revert("Not implemented");
    }

}

