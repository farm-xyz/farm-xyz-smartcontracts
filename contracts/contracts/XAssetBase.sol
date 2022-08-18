// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "./IXAsset.sol";
import "../strategies/IXStrategy.sol";
import "./XAssetShareToken.sol";
import "../strategies/FarmStrategy.sol";
import "..\FarmXYZBase.sol";

// todo #1: events
// todo #2: bridge
// todo #3: strategy
// todo #4: base-token
// todo #5: shares
// todo #6: share value conversion in x-base-token
// zapper - conversie automata

contract XAssetBase is IXAsset, Ownable {
    string public name = "XAssetBase";

    uint256 public totalShares;

    address private baseToken;

    IXStrategy private strategy;

    XAssetShareToken private shareToken;

    bool private _strategyIsInitialized = false;

    /**
     * @dev Emitted when `value` tokens are invested into an XAsset
     */
    event Invest(address indexed from, uint256 amount);

    /**
     * @dev Emitted when `value` tokens are withdrawn from an XAsset
     */
    event Withdraw(address indexed to, uint256 amount);

    /**
     * @param _baseToken - The token in which conversions are made by default
     * @param _shareToken - The contract which holds the shares
     */
    constructor(address _baseToken, XAssetShareToken _shareToken) {// todo: move strategy to initialized function, add baseToken
        baseToken = _baseToken;
        shareToken = _shareToken;

        // todo: ?? mint 100 shares to 0x0
        // notes @Florin: --> "ERC20: mint to the zero address" : can't mint to 0x0 due to ERC20 condition in _mint(...)
        // notes @Florin: in this case the `msg.sender` should be the owner, right?
        _shareToken.mint(msg.sender, 100);

        totalShares = uint256(0);
    }

    // todo: have a createStrategy function that instantiates the strategy with the right params
    // todo: onlyOnwer, can only run once
    function createStrategy(IXStrategy _strategy) public onlyOwner {
        if (_strategyIsInitialized == false) {
            strategy = _strategy;
            _strategyIsInitialized = true;
        }
    }

    function invest(address token, uint256 amount) override public {
        console.log('invest', token, amount);

        // TODO: calculate amount of shares for the user
        // TODO: add shares to the total amount

        totalShares += amount;
    }

    function estimateSharesForInvestmentAmount(address token, uint256 amount) public view returns (uint256) {
        // todo: add estimateSharesForInvestmentAmount(token, amount)
        return 0;
    }

    function withdraw(uint256 amount) override public {
        console.log('withdraw', amount);
    }

    // todo: think of how this works if we have 0 shares invested
    function getPrice(uint256 amount) override public view returns (uint256) {
        console.log('getPrice', amount);

        return strategy.convert(baseToken, amount);
    }

    // getSharePrice -> price per 1 share
    function getSharePrice() public view returns (uint256) {
        // todo: calculate price per 1 share only, in the base token
        // notes @Florin: how and where do we calculate the price for one share? Here or in the strategy?

        return strategy.convert(baseToken, 1);
    }

    // getTVL -> total Value Locked in baseToken -> returned by the strategy
    function getTVL() public view returns (uint256) {
        // notes @Florin: how to calculate TVL for shares? Implemented similarly as for FarmXYZBase

        return strategy.convert(baseToken, shareToken.totalValueLocked());
    }

    // getTotalValueOwnedBy(address): total value invested by address in this xAsset, in baseToken
    function getTotalValueOwnedBy(address account) public view returns (uint256) {
        return shareToken.balanceOf(account);
    }
}
