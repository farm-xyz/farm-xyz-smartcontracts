// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXStrategy.sol";
import "../bridges/IXPlatformBridge.sol";
import "../contracts/IXAsset.sol";
import "../FarmXYZBase.sol";
import "../utils/Trigonometry.sol";

// todo: we'll have multiple strategy types: LPStrategy, LPFarmStrategy, FarmStrategy, MultifarmStrategy, etc.
contract FarmStrategy is IXStrategy, OwnableUpgradeable, UUPSUpgradeable {

    string public name;

    IXPlatformBridge private _bridge;

    FarmXYZBase private _farm;
    IERC20Metadata private _baseToken;

    uint256 private _totalValueLocked;

    uint256 private _virtualSharesInvestmentStartTime;



    /**
     * @param bridge_ - The strategy used to manage actions between investment assets
     * @param farm_ - The farm used for investing
     * @param baseToken_ - The base token used for different conversion
     */
    /**
     */
    function initialize(IXPlatformBridge bridge_,
        FarmXYZBase farm_,
        IERC20Metadata baseToken_) initializer external {
        __UUPSUpgradeable_init();

        name = "FarmStrategy";
        // todo: add xAsset, pool param, add baseToken, assets to convert to

        _bridge = bridge_;
        _farm = farm_;
        _baseToken = baseToken_;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // invest(token, amount, slippage) -> returns the amount invested in baseTokens
    //  -> uses PlatformBridge to find amount of tokens to convert to based on the target pool
    //  -> uses DexBridge to convert token amount into target tokens, with the specific slippage
    //  -> stake converted assets to pool
    //  -> returns baseToken amount invested
    function invest(IERC20Metadata token, uint256 amount, int slippage) override external returns (uint256) {
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
        console.log('----- [strategy:withdraw] tvl %s amount %s', _totalValueLocked /1 ether, amount/1 ether);
        _totalValueLocked -= amount;
        return amount;
    }

    function convert(IERC20Metadata token, uint256 amount) view override public returns (uint256) {
        console.log('---- [strategy:convert]', amount/1 ether, address(token));
        // TODO: handle conversion between token & assets

        return amount;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return _totalValueLocked;
    }

    /**
     * @return The total value of the virtually invested assets
     */
    function getTotalVirtualAssetValue() override view external returns (uint256) {
        // Let's do a sine function price to have a nice graph to test with
        uint256 denominator = 10**_baseToken.decimals();
        uint256 origPrice = 1000*denominator;
        uint256 secs = block.timestamp - _virtualSharesInvestmentStartTime;
        console.log('---- [strategy:getTotalVirtualAssetValue] secs %s', secs);
        uint256 sin = uint256(32767 + Trigonometry.sin(uint16(secs % (2**16))));
        if (sin==0) sin=1;
        uint256 priceDiff = ((65534*denominator)/sin) * 200;
        console.log('sin %s percent %s diff %s', sin, ((65534*denominator)/sin), priceDiff);
        uint256 price = origPrice+priceDiff;
        console.log("=> %s.%s", price/1 ether, price%1 ether);
        return price;
    }

    /**
     * @dev Virtually invest some tokens in the pool/farm, returns the total amount of baseTokens "invested"
     */
    function virtualInvest(uint256 amount) override external returns (uint256) {
        _virtualSharesInvestmentStartTime = block.timestamp;
        return amount;
    }
}
