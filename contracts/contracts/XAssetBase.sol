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
        _shareToken = shareToken_;
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
        _strategy.virtualInvest( 1000 * (10**_baseToken.decimals() ));
        _totalVirtualShares = 100;
    }

    /**
     * @return The price per one share of the XASSET
     */
    function getSharePrice() override external view returns (uint256) {
        uint256 totalVirtualAssetsValue = _strategy.getTotalVirtualAssetValue();
        uint256 sharePrice = totalVirtualAssetsValue / _totalVirtualShares;
        console.log('---- [xasset:getSharePrice] => ', sharePrice/1 ether);
        return sharePrice;
    }

    function invest(IERC20Metadata token, uint256 amount) override external {
        console.log('---- [xasset:invest]', address(token), amount);

        if ( _shareToken.totalSupply()== 0 ) {
            console.log("Initial investment into XASSET");
            uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
            require(totalAssetValueBeforeInvest == 0, "Strategy should have no assets since no shares have been issued");
            console.log("Will invest %s tokens using strategy", amount/1 ether);
            _strategy.invest(token, amount, 50);
            uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
            console.log("Total asset value after invest: ", totalAssetValueAfterInvest/1 ether);
            uint256 sharePrice = this.getSharePrice();
            console.log("Share price: ", sharePrice/1 ether);
            uint256 newSharesToMint = totalAssetValueAfterInvest/sharePrice;
            console.log("New shares to mint: ", newSharesToMint);
            _shareToken.mint(_msgSender(), newSharesToMint);
            console.log("Total share supply: ", _shareToken.totalSupply());
            uint256 pricePerShareAfterInvest = totalAssetValueAfterInvest/ _shareToken.totalSupply();
            console.log("Price per share after invest: ", pricePerShareAfterInvest/1 ether);
            require(pricePerShareAfterInvest == sharePrice, "Price per share can not change after initial investment");
        } else {
            uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
            uint256 pricePerShareBeforeInvest = totalAssetValueBeforeInvest/ _shareToken.totalSupply();
            _strategy.invest(token, amount, 50);
            uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
            uint256 totalAssetValueInvested = totalAssetValueAfterInvest - totalAssetValueBeforeInvest;
            uint256 newSharesToMint = totalAssetValueInvested/pricePerShareBeforeInvest;
            _shareToken.mint(_msgSender(), newSharesToMint);
            uint256 pricePerShareAfterInvest = totalAssetValueAfterInvest/ _shareToken.totalSupply();
            require(pricePerShareAfterInvest == pricePerShareBeforeInvest, "Price per share can not change after investment");
        }
    }

    function estimateSharesForInvestmentAmount(IERC20Metadata token, uint256 amount) external view returns (uint256) {
        uint256 totalAssetValue = _strategy.getTotalAssetValue();
        uint256 pricePerShare = this.getSharePrice();
        uint256 baseTokenAmount = _strategy.convert(token, amount);
        uint256 shares = baseTokenAmount/pricePerShare;
        return shares;
    }

    function withdraw(uint256 shares) override external {
        console.log('---- [xasset:withdraw]', shares);
        require(_shareToken.balanceOf(_msgSender()) >= shares, "Not enough shares");
        uint256 totalAssetValueBeforeWithdraw = _strategy.getTotalAssetValue();
        console.log("Total asset value before withdraw: ", totalAssetValueBeforeWithdraw/1 ether);
        uint256 pricePerShareBeforeWithdraw = totalAssetValueBeforeWithdraw / _shareToken.totalSupply();
        console.log("Price per share before withdraw: ", pricePerShareBeforeWithdraw/1 ether);
        uint256 amountToWithdraw = shares * pricePerShareBeforeWithdraw;
        uint256 withdrawn = _strategy.withdraw(amountToWithdraw, _baseToken, 50);
        require(withdrawn == amountToWithdraw, "Withdrawal amount does not match");
        _shareToken.burn(_msgSender(), shares);
        uint256 totalAssetValueAfterWithdraw = _strategy.getTotalAssetValue();
        uint256 pricePerShareAfterWithdraw = totalAssetValueAfterWithdraw / _shareToken.totalSupply();
        require(pricePerShareAfterWithdraw == pricePerShareBeforeWithdraw, "Price per share changed");
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
        uint256 totalValue = this.getTotalSharesOwnedBy(account) * this.getSharePrice();
        console.log("---- [xasset:getTotalValueOwnedBy] => %s*%s = %s", this.getTotalSharesOwnedBy(account), this.getSharePrice()/1 ether, totalValue/1 ether);
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
