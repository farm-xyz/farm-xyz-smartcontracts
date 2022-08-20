// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
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

contract XAssetBase is IXAsset, OwnableUpgradeable {

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

    bool private _strategyIsInitialized = false;

    /**
     * The strategy used to manage actions between investment assets.
     */
    IXStrategy private _strategy;

    /**
     * The total no of virtualShares invested in virtual assets using the strategy.
     */
    uint256 private _totalVirtualShares = 0;

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

        _name = name_;
        _baseToken = baseToken_;
        _shareToken = shareToken_;
    }

    /**
     * @return The name of the XASSET
     */
    function name() public view virtual returns (string memory) {
        return _name;
    }

    function setStrategy(IXStrategy strategy_) public onlyOwner {
        require(!_strategyIsInitialized, "Strategy is already initialized");
        _strategyIsInitialized = true;
        _strategy = strategy_;

        // Once we have a strategy let's invest some virtual assets so we can calculate share values
        // We start with a share value of $10, and 100 shares
        _strategy.virtualInvest( 1000 * (10**_baseToken.decimals() ));
        _totalVirtualShares = 100;
    }

    function invest(IERC20Metadata token, uint256 amount) override external {
        console.log('invest', address(token), amount);

        uint256 totalAssetValueBeforeInvest = _strategy.getTotalAssetValue();
        uint256 pricePerShareBeforeInvest = totalAssetValueBeforeInvest/ _shareToken.totalSupply();
        _strategy.invest(token, amount, 50);
        uint256 totalAssetValueAfterInvest = _strategy.getTotalAssetValue();
        uint256 totalAssetValueInvested = totalAssetValueAfterInvest - totalAssetValueBeforeInvest;
        uint256 newSharesToMint = totalAssetValueInvested/pricePerShareBeforeInvest;
        _shareToken.mint(msg.sender, newSharesToMint);
        uint256 pricePerShareAfterInvest = totalAssetValueAfterInvest/ _shareToken.totalSupply();
        require(pricePerShareAfterInvest == pricePerShareBeforeInvest, "Price per share changed");
    }

    function estimateSharesForInvestmentAmount(IERC20Metadata token, uint256 amount) external view returns (uint256) {
        uint256 totalAssetValue = _strategy.getTotalAssetValue();
        uint256 pricePerShare = totalAssetValue/ _shareToken.totalSupply();
        uint256 baseTokenAmount = _strategy.convert(token, amount);
        uint256 shares = baseTokenAmount/pricePerShare;
        return shares;
    }

    function withdraw(uint256 shares) override external {
        console.log('withdraw', shares);
        require(_shareToken.balanceOf(msg.sender) >= shares, "Not enough shares");
        uint256 totalAssetValueBeforeWithdraw = _strategy.getTotalAssetValue();
        uint256 pricePerShareBeforeWithdraw = totalAssetValueBeforeWithdraw / _shareToken.totalSupply();
        _strategy.withdraw(pricePerShareBeforeWithdraw * shares, _baseToken, 50);
        _shareToken.burn(msg.sender, shares);
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
     * @return The price per one share of the XASSET
     */
    function getSharePrice() override external view returns (uint256) {
        uint256 totalVirtualAssetsValue = _strategy.getTotalVirtualAssetValue();
        uint256 sharePrice = totalVirtualAssetsValue / _totalVirtualShares;
        console.log('getSharePrice', sharePrice);
        return sharePrice;
    }

    /**
     * @return Returns the total amount of baseTokens that are invested in this XASSET
     */
    function getTVL() override external view returns (uint256) {
        return _strategy.getTotalAssetValue();
    }

    /**
     * @return Total value invested by address in this xAsset, in baseToken
     */
    function getTotalValueOwnedBy(address account) override external view returns (uint256) {
        return _shareToken.balanceOf(account) * this.getSharePrice();
    }
}
