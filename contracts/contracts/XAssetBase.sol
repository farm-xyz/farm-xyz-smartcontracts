// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
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
    function setStrategy(IXStrategy _strategy) public onlyOwner {
        require(!_strategyIsInitialized, "Strategy is already initialized");
        strategy = _strategy;
        _strategyIsInitialized = true;
    }

    function invest(address token, uint256 amount) override public {
        console.log('invest', token, amount);

        // TODO: calculate amount of shares for the user:
        // 1. getTotalAssetValue from strategy
        // 2. invest new amount using strategy
        // 3. getTotalAssetValue from strategy again
        // 4. calculate difference in value of the new investment
        // 5. emit shares for that difference in value
        // TODO: add shares to the total amount

        totalShares += amount;
    }

    function estimateSharesForInvestmentAmount(address token, uint256 amount) public view returns (uint256) {
        // todo: add estimateSharesForInvestmentAmount(token, amount)
        return 0;
    }

    function withdraw(uint256 shares) override public {
        console.log('withdraw', shares);
        // 1. Validate user has enough shares
        // 2. getTotalAssetValue from strategy
        // 3. calculate price per share
        // 4. withdraw amount using strategy
        // 5. getTotalAssetValue from strategy again
        // 6. validate difference in value of the new withdrawal
        // 7. burn shares for that difference in value
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
        // notes @Alex: XAsset asks the strategy the total value of all assets owned - then calculates price per share,
        //              value of user's shares, etc

//        return strategy.convert(baseToken, shareToken.totalValueLocked());
        return strategy.convert(baseToken, 0);
    }

    // getTotalValueOwnedBy(address): total value invested by address in this xAsset, in baseToken
    function getTotalValueOwnedBy(address account) public view returns (uint256) {
        return shareToken.balanceOf(account);
    }
}
