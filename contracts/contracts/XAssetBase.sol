// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "hardhat/console.sol";
import "./IXAsset.sol";
import "../strategies/IXStrategy.sol";
import "./XAssetShareToken.sol";
import "../strategies/FarmStrategy.sol";
import "../FarmXYZBase.sol";

// todo #1: events
// todo #2: bridge
// todo #3: strategy
// todo #4: base-token
// todo #5: shares
// todo #6: share value conversion in x-base-token
// zapper - conversie automata

contract XAssetBase is IXAsset, OwnableUpgradeable, ERC2771Recipient, UUPSUpgradeable {

    /**
     * The name of this XASSET
     */
    string private _name;

    /**
     * The base token that all investments are denominated in.
     */
    IERC20Metadata private _baseToken;

    /**
     * The share token emitted by the XASSET
     */
    XAssetShareToken private _shareToken;

    bool private _strategyIsInitialized;

    /**
     * The strategy used to manage actions between investment assets.
     */
    IXStrategy private _strategy;

    /**
     * The total no of virtualShares invested in virtual assets using the strategy.
     */
    uint256 private _totalVirtualShares;

    /**
     * The power of ten used to calculate share tokens number
     */
    uint256 private _shareTokenDenominator;
    
    
    /**
     * The denominator for the base token
     */    
    uint256 private _baseTokenDenominator;

    /**
     * @dev Emitted when `value` tokens are invested into an XAsset
     */
    event Invest(address indexed from, uint256 amount);

    /**
     * @dev Emitted when `value` tokens are withdrawn from an XAsset
     */
    event Withdraw(address indexed to, uint256 amount);

    /**
     * @param name_ The name of this XASSET
     * @param baseToken_ The token in which conversions are made by default
     * @param shareToken_ The contract which holds the shares
     */
    function initialize(string calldata name_, IERC20Metadata baseToken_, XAssetShareToken shareToken_) initializer external {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _name = name_;
        _baseToken = baseToken_;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
        _shareToken = shareToken_;
        _shareTokenDenominator = 10 ** _shareToken.decimals();
        _strategyIsInitialized = false;
        _totalVirtualShares = 0;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setTrustedForwarder(address _forwarder) public onlyOwner {
        _setTrustedForwarder(_forwarder);
    }

    /**
     * @return The name of the XASSET
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    function setStrategy(IXStrategy strategy_) public onlyOwner {
        require(!_strategyIsInitialized, "Strategy is already initialized");
        console.log("---- [xasset:setStrategy] ", address(strategy_));
        _strategyIsInitialized = true;
        _strategy = strategy_;

        // Once we have a strategy let's invest some virtual assets so we can calculate share values
        // We start with a share value of $10, and 100 shares
        _strategy.virtualInvest( 1000 * _baseTokenDenominator );
        _totalVirtualShares = 100*_shareTokenDenominator;
    }

    /**
     * @return The price per one share of the XASSET
     */
    function getSharePrice() override external view returns (uint256) {
        uint256 totalVirtualAssetsValue = _strategy.getTotalVirtualAssetValue();
        uint256 sharePrice = totalVirtualAssetsValue*_shareTokenDenominator / _totalVirtualShares;
        console.log('---- [xasset:getSharePrice]');
        console.log('TVL $%s.%s', totalVirtualAssetsValue/_baseTokenDenominator, totalVirtualAssetsValue%_baseTokenDenominator);
        console.log('Total Shares %s.%s', _totalVirtualShares/_shareTokenDenominator, _totalVirtualShares%_shareTokenDenominator);
        console.log('======> $%s.%s', sharePrice/_baseTokenDenominator, sharePrice%_baseTokenDenominator);
        return sharePrice;
    }

    function _checkPriceDifference(uint256 priceBefore, uint256 priceAfter) internal view returns (uint256) {
        if (priceBefore > priceAfter) {
            require((priceBefore - priceAfter) < 10, "Price per share can not change more than 10wei after any operation");
            return priceBefore - priceAfter;
        } else {
            require((priceAfter - priceBefore) < 10, "Price per share can not change more than 10wei after any operation");
            return priceAfter - priceBefore;
        }
    }

    function invest(IERC20Metadata token, uint256 amount) override external {
        console.log('---- [xasset:invest] %s = $%s.%s', address(token), amount/_baseTokenDenominator, amount%_baseTokenDenominator);

        uint256 tvlBeforeInvest = _strategy.getTotalVirtualAssetValue();

        if ( _shareToken.totalSupply()== 0 ) {
            console.log("Initial investment into XASSET");
            uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
            require(totalAssetValueBeforeInvest == 0, "Strategy should have no assets since no shares have been issued");
            console.log("Will invest $%s.%s using strategy", amount/_baseTokenDenominator, amount%_baseTokenDenominator);
            _strategy.invest(token, amount, 50);
            uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
            console.log("Total asset value after invest: $%s.%s", totalAssetValueAfterInvest/_baseTokenDenominator, totalAssetValueAfterInvest%_baseTokenDenominator);
            uint256 sharePrice = this.getSharePrice();
            console.log("Share price: $%s.%s", sharePrice/_baseTokenDenominator, sharePrice%_baseTokenDenominator);
            uint256 newSharesToMint = totalAssetValueAfterInvest*_shareTokenDenominator/sharePrice;
            console.log("New shares to mint: %s.%s", newSharesToMint/_shareTokenDenominator, newSharesToMint%_shareTokenDenominator);
            _shareToken.mint(_msgSender(), newSharesToMint);
            console.log("Total share supply: ", _shareToken.totalSupply());
            uint256 pricePerShareAfterInvest = totalAssetValueAfterInvest*_shareTokenDenominator/ _shareToken.totalSupply();
            console.log("Price per share after invest: $%s.%s", pricePerShareAfterInvest/_baseTokenDenominator, pricePerShareAfterInvest%_baseTokenDenominator);
            _checkPriceDifference(pricePerShareAfterInvest, sharePrice);

        } else {
            console.log("Additional investment into XASSET");
            uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
            console.log("totalAssetValueBeforeInvest = $%s.%s", totalAssetValueBeforeInvest/_baseTokenDenominator, totalAssetValueBeforeInvest%_baseTokenDenominator);
            uint256 pricePerShareBeforeInvest = totalAssetValueBeforeInvest*_shareTokenDenominator/ _shareToken.totalSupply();
            console.log("pricePerShareBeforeInvest = $%s.%s", pricePerShareBeforeInvest/_baseTokenDenominator, pricePerShareBeforeInvest%_baseTokenDenominator);
            _strategy.invest(token, amount, 50);
            uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
            console.log("totalAssetValueAfterInvest = $%s.%s", totalAssetValueAfterInvest/_baseTokenDenominator, totalAssetValueAfterInvest%_baseTokenDenominator);
            uint256 totalAssetValueInvested = totalAssetValueAfterInvest - totalAssetValueBeforeInvest;
            console.log("totalAssetValueInvested = $%s.%s", totalAssetValueInvested/_baseTokenDenominator, totalAssetValueInvested%_baseTokenDenominator);
            uint256 newSharesToMint = totalAssetValueInvested*_shareTokenDenominator/pricePerShareBeforeInvest;
            console.log("newSharesToMint = %s.%s", newSharesToMint/_shareTokenDenominator, newSharesToMint%_shareTokenDenominator);
            _shareToken.mint(_msgSender(), newSharesToMint);
            uint256 pricePerShareAfterInvest = totalAssetValueAfterInvest*_shareTokenDenominator/_shareToken.totalSupply();
            console.log("pricePerShareAfterInvest = $%s.%s", pricePerShareAfterInvest/_baseTokenDenominator, pricePerShareAfterInvest%_baseTokenDenominator);
            _checkPriceDifference(pricePerShareBeforeInvest, pricePerShareAfterInvest);
        }

        uint256 tvlAfterInvest = _strategy.getTotalVirtualAssetValue();
        console.log("TVL before invest: $%s.%s", tvlBeforeInvest/_baseTokenDenominator, tvlBeforeInvest%_baseTokenDenominator);
        console.log("TVL after invest: $%s.%s", tvlAfterInvest/_baseTokenDenominator, tvlAfterInvest%_baseTokenDenominator);
        console.log("TVL diff: $%s.%s", (tvlAfterInvest-tvlBeforeInvest)/_baseTokenDenominator, (tvlAfterInvest-tvlBeforeInvest)%_baseTokenDenominator);
        console.log("====> Invested $%s.%s", amount/_baseTokenDenominator, amount%_baseTokenDenominator);
    }

    function estimateSharesForInvestmentAmount(IERC20Metadata token, uint256 amount) external view returns (uint256) {
        uint256 pricePerShare = this.getSharePrice();
        uint256 baseTokenAmount = _strategy.convert(token, amount);
        uint256 shares = baseTokenAmount*_shareTokenDenominator/pricePerShare;
        console.log("---- [xasset:estimateSharesForInvestmentAmount] $%s.%s", amount/_baseTokenDenominator, amount%_baseTokenDenominator);
        console.log("======> %s.%s", shares/_shareTokenDenominator, shares%_shareTokenDenominator);
        return shares;
    }

    function withdraw(uint256 shares) override external {
        console.log('---- [xasset:withdraw]', shares);
        require(_shareToken.balanceOf(_msgSender()) >= shares, "Not enough shares");
        uint256 totalAssetValueBeforeWithdraw = _strategy.getTotalAssetValue();
        console.log("Total asset value before withdraw: $%s.%s", totalAssetValueBeforeWithdraw/_baseTokenDenominator, totalAssetValueBeforeWithdraw%_baseTokenDenominator);
        uint256 pricePerShareBeforeWithdraw = totalAssetValueBeforeWithdraw * _shareTokenDenominator/ _shareToken.totalSupply();
        console.log("Price per share before withdraw: $%s.%s", pricePerShareBeforeWithdraw/_baseTokenDenominator, pricePerShareBeforeWithdraw%_baseTokenDenominator);
        uint256 amountToWithdraw = shares * pricePerShareBeforeWithdraw / _shareTokenDenominator;
        console.log("Amount to withdraw: $%s.%s", amountToWithdraw/_baseTokenDenominator, amountToWithdraw%_baseTokenDenominator);
        uint256 withdrawn = _strategy.withdraw(amountToWithdraw, _baseToken, 50);
        require(withdrawn == amountToWithdraw, "Withdrawal amount does not match");
        console.log("burning %s.%s shares", shares/_shareTokenDenominator, shares%_shareTokenDenominator);
        _shareToken.burn(_msgSender(), shares);
        uint256 totalAssetValueAfterWithdraw = _strategy.getTotalAssetValue();
        uint256 pricePerShareAfterWithdraw = totalAssetValueAfterWithdraw * _shareTokenDenominator / _shareToken.totalSupply();
        uint256 diff = _checkPriceDifference(pricePerShareBeforeWithdraw, pricePerShareAfterWithdraw);
        console.log("Slippage: $%s.%s", diff/_baseTokenDenominator, diff%_baseTokenDenominator);
        console.log("====> withdrawn $%s.%s", amountToWithdraw/_baseTokenDenominator, amountToWithdraw%_baseTokenDenominator);
    }


    /**
     * @param amount - The amount of shares to calculate the value of
     * @return The value of amount shares in baseToken
     */
    function getValueForShares(uint256 amount) override external view returns (uint256) {
        return this.getSharePrice() * amount;
    }

    /**
     * @return Returns the total amount of baseTokens that are invested in this XASSET
     */
    function getTVL() override external view returns (uint256) {
        return _strategy.getTotalAssetValue();
    }

    /**
     * @return Total shares owned by address in this xAsset
     */
    function getTotalSharesOwnedBy(address account) override external view returns (uint256) {
        return _shareToken.balanceOf(account);
    }

    /**
     * @return Total value invested by address in this xAsset, in baseToken
     */
    function getTotalValueOwnedBy(address account) override external view returns (uint256) {
        uint256 sharePrice = this.getSharePrice();
        uint256 totalValue = (this.getTotalSharesOwnedBy(account) * sharePrice) / _shareTokenDenominator;
        console.log("---- [xasset:getTotalValueOwnedBy]", this.getTotalSharesOwnedBy(account)/_shareTokenDenominator, this.getTotalSharesOwnedBy(account)%_shareTokenDenominator);
        console.log("- shares: %s.%s", this.getTotalSharesOwnedBy(account)/_shareTokenDenominator, this.getTotalSharesOwnedBy(account)%_shareTokenDenominator);
        console.log("- price: $%s.%s", sharePrice/_baseTokenDenominator, sharePrice%_baseTokenDenominator);
        console.log("======>  $%s.%s", totalValue/_baseTokenDenominator, totalValue%_baseTokenDenominator);
        return totalValue;
    }

    function shareToken() override external view returns (IERC20MetadataUpgradeable) {
        return _shareToken;
    }

    function _msgSender() internal override(ERC2771Recipient, ContextUpgradeable) virtual view returns (address ret) {
        return ERC2771Recipient._msgSender();
    }

    function _msgData() internal override(ERC2771Recipient, ContextUpgradeable) virtual view returns (bytes calldata ret) {
        return ERC2771Recipient._msgData();
    }
}
