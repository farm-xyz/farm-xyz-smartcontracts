// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@prb/proxy/contracts/IPRBProxyRegistry.sol";

import "./IXAsset.sol";
import "../strategies/IXStrategy.sol";
import "./XAssetShareToken.sol";
import "../farms/FarmXYZBase.sol";
import "hardhat/console.sol";

// todo #1: events
// todo #2: bridge
// todo #3: strategy
// todo #4: base-token
// todo #5: shares
// todo #6: share value conversion in x-base-token
// zapper - conversie automata

contract XAssetBase is IXAsset, OwnableUpgradeable, ERC2771Recipient, UUPSUpgradeable
{
    uint256 constant MAX_UINT256 = 2 ** 256 - 1;
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

    IPRBProxyRegistry private _proxyRegistry;

    bool private _strategyIsInitialized;

    bool private _initialInvestmentDone;

    /**
     * The strategy used to manage actions between investment assets.
     */
    IXStrategy private _strategy;

    /**
     * The power of ten used to calculate share tokens number
     */
    uint256 private _shareTokenDenominator;

    /**
     * The denominator for the base token
     */
    uint256 private _baseTokenDenominator;

    uint256 private _acceptedPriceDifference;

    /**
     * @dev Emitted when `value` tokens are invested into an XAsset
     */
    event Invest(address indexed from, uint256 amount);

    /**
     * @dev Emitted when `value` tokens are withdrawn from an XAsset
     */
    event Withdraw(address indexed to, uint256 amount);

    /**
     * @dev Emitted when the xAsset is initialized & first investment is done
     */
    event XAssetInitialized();

    /**
     * @param name The name of this XASSET
     * @param baseToken The token in which conversions are made by default
     * @param shareToken The contract which holds the shares
     */
    function initialize(
        string calldata name,
        IERC20Metadata baseToken,
        XAssetShareToken shareToken
    ) external initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _name = name;
        _baseToken = baseToken;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
        _shareToken = shareToken;
        _shareTokenDenominator = 10 ** _shareToken.decimals();
        _strategyIsInitialized = false;
        _initialInvestmentDone = false;
        _acceptedPriceDifference = 1000;
        _proxyRegistry = IPRBProxyRegistry(0x43fA1CFCacAe71492A36198EDAE602Fe80DdcA63);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setTrustedForwarder(address forwarder) public onlyOwner {
        _setTrustedForwarder(forwarder);
    }

    function setAcceptedPriceDifference(uint256 priceDifference) public onlyOwner {
        _acceptedPriceDifference = priceDifference;
    }

    /**
     * @return The name of the XASSET
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    function setStrategy(IXStrategy strategy) public onlyOwner {
        require(!_strategyIsInitialized, "Strategy is already initialized");
        _strategyIsInitialized = true;
        _strategy = strategy;
    }

    function executeInitialInvestment() external onlyOwner {
        require(!_initialInvestmentDone, "Initial investment is already done");

        uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
        require(
            totalAssetValueBeforeInvest == 0,
            "Strategy should have no assets since no shares have been issued"
        );

        // We start with a share value of $10, and 1 share
        uint256 amount = 10 * _baseTokenDenominator;
        _baseToken.approve(address(_strategy), amount);
        _strategy.invest(_baseToken, amount, amount, 50);
        _shareToken.mint(address(this), 1 * _shareTokenDenominator);
        _initialInvestmentDone = true;
        emit Invest(address(this), amount);
        emit XAssetInitialized();

        uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();

        uint256 pricePerShareAfterInvest = this.getSharePrice();
    }

    /**
     * @return The price per one share of the XASSET
     */
    function getSharePrice() external view override returns (uint256) {
        if (!_initialInvestmentDone) {
            return 0;
        }
        uint256 totalAssetsValue = _strategy.getTotalAssetValue();
        uint256 sharePrice = (totalAssetsValue * _shareTokenDenominator) / _shareToken.totalSupply();
        return sharePrice;
    }

    function _checkPriceDifference(uint256 priceBefore, uint256 priceAfter)
        internal
        view
        returns (uint256)
    {
        if (priceBefore > priceAfter) {
            require(
                (priceBefore - priceAfter) < _acceptedPriceDifference,
                "Price per share can not change more than accepted price difference after any operation"
            );
            return priceBefore - priceAfter;
        } else {
            require(
                (priceAfter - priceBefore) < _acceptedPriceDifference,
                "Price per share can not change more than accepted price difference after any operation"
            );
            return priceAfter - priceBefore;
        }
    }

    function invest(IERC20Metadata token, uint256 amount)
        external
        override
        returns (uint256)
    {
//        console.log("[xasset][invest] token: %s, amount: %s", token.symbol(), amount);
        require(_shareToken.totalSupply() > 0, "Initial investment is not done yet");

        require(token.transferFrom(_msgSender(), address(this), amount), "ERC20: transfer failed");
        if (token.allowance(address(this), address(_strategy)) < amount) {
            token.approve(address(_strategy), MAX_UINT256);
        }

        uint256 newShares = 0;

        _strategy.compound();
        uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
//        console.log("[xasset][invest] totalAssetValueBeforeInvest: %s", totalAssetValueBeforeInvest);
        uint256 pricePerShareBeforeInvest = this.getSharePrice();
        _strategy.invest(token, amount, amount, 50);

        uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
        uint256 totalAssetValueInvested = totalAssetValueAfterInvest - totalAssetValueBeforeInvest;
        console.log("[xasset][invest] totalAssetValueAfterInvest: %s", totalAssetValueAfterInvest);

        newShares =
        (totalAssetValueInvested * _shareTokenDenominator) /
        pricePerShareBeforeInvest;
        console.log("[xasset][invest] newShares: %s", newShares);
        _shareToken.mint(_msgSender(), newShares);
        uint256 pricePerShareAfterInvest = this.getSharePrice();
        console.log("[xasset][invest] pricePerShareBeforeInvest", pricePerShareBeforeInvest);
        console.log("[xasset][invest] pricePerShareAfterInvest", pricePerShareAfterInvest);
        _checkPriceDifference(
            pricePerShareBeforeInvest,
            pricePerShareAfterInvest
        );

        emit Invest(_msgSender(), amount);
        return newShares;
    }

    function estimateSharesForInvestmentAmount(
        IERC20Metadata token,
        uint256 amount
    ) external view returns (uint256) {
        uint256 pricePerShare = this.getSharePrice();
        uint256 baseTokenAmount = _strategy.convert(token, amount);
        uint256 shares = (baseTokenAmount * _shareTokenDenominator) /
        pricePerShare;
        return shares;
    }

    function _withdrawFrom(address owner, uint256 shares) private returns (uint256) {
        if (_msgSender() != owner) {
            require(
                address(_proxyRegistry.getCurrentProxy(owner)) == _msgSender(),
                "Only owner or proxy can withdraw"
            );
            require(
                _shareToken.balanceOf(owner) >= shares,
                "You don't own enough shares"
            );
        } else {
            require(
                _shareToken.balanceOf(_msgSender()) >= shares,
                "You don't own enough shares"
            );
        }
        uint256 totalAssetValueBeforeWithdraw = _strategy.getTotalAssetValue();
//        console.log("[xasset][withdraw] totalAssetValueBeforeWithdraw: %s", totalAssetValueBeforeWithdraw);
        uint256 pricePerShareBeforeWithdraw = this.getSharePrice();
//        console.log("[xasset][withdraw] pricePerShareBeforeWithdraw: %s", pricePerShareBeforeWithdraw);
        uint256 amountToWithdraw = (shares * pricePerShareBeforeWithdraw) / _shareTokenDenominator;
//        console.log("[xasset][withdraw] amountToWithdraw: %s", amountToWithdraw);

        uint256 withdrawn = _strategy.withdraw(
            amountToWithdraw,
            _baseToken,
            50
        );
        require(
            withdrawn == amountToWithdraw,
            "Withdrawal amount does not match"
        );
        require(_baseToken.transfer(owner, withdrawn), "ERC20: transfer failed");
        _shareToken.burn(owner, shares);

        uint256 totalAssetValueAfterWithdraw = _strategy.getTotalAssetValue();
        uint256 pricePerShareAfterWithdraw = (totalAssetValueAfterWithdraw *
        _shareTokenDenominator) / _shareToken.totalSupply();
        uint256 diff = _checkPriceDifference(
            pricePerShareBeforeWithdraw,
            pricePerShareAfterWithdraw
        );
        emit Withdraw(owner, amountToWithdraw);
        return amountToWithdraw;
    }

    function withdrawFrom(address owner, uint256 shares) external override returns (uint256) {
        return _withdrawFrom(owner, shares);
    }

    function withdraw(uint256 shares) external override returns (uint256)
    {
        return _withdrawFrom(_msgSender(), shares);
    }

    function getBaseToken() override external view returns (IERC20Metadata)
    {
        return _baseToken;
    }

    /**
     * @param amount - The amount of shares to calculate the value of
     * @return The value of amount shares in baseToken
     */
    function getValueForShares(uint256 amount)
    external
    view
    override
    returns (uint256)
    {
        return this.getSharePrice() * amount;
    }

    /**
     * @return Returns the total amount of baseTokens that are invested in this XASSET
     */
    function getTVL() external view override returns (uint256) {
        return _strategy.getTotalAssetValue();
    }

    /**
     * @return Total shares owned by address in this xAsset
     */
    function getTotalSharesOwnedBy(address account)
    external
    view
    override
    returns (uint256)
    {
        return _shareToken.balanceOf(account);
    }

    /**
     * @return Total value invested by address in this xAsset, in baseToken
     */
    function getTotalValueOwnedBy(address account)
    external
    view
    override
    returns (uint256)
    {
        uint256 sharePrice = this.getSharePrice();
        uint256 accountShares = this.getTotalSharesOwnedBy(account);
        uint256 totalValue = (accountShares * sharePrice) /
        _shareTokenDenominator;
        return totalValue;
    }

    function shareToken()
    external
    view
    override
    returns (IERC20MetadataUpgradeable)
    {
        return _shareToken;
    }

    function _msgSender()
    internal
    view
    virtual
    override(ERC2771Recipient, ContextUpgradeable)
    returns (address ret)
    {
        return ERC2771Recipient._msgSender();
    }

    function _msgData()
    internal
    view
    virtual
    override(ERC2771Recipient, ContextUpgradeable)
    returns (bytes calldata ret)
    {
        return ERC2771Recipient._msgData();
    }

    //    function logTokenValue(string memory message, uint256 amount) internal view {
    //        log.value(message, amount, _baseTokenDenominator);
    //    }
    //
    //    function logShareValue(string memory message, uint256 amount) internal view {
    //        log.value(message, amount, _shareTokenDenominator);
    //    }
}
