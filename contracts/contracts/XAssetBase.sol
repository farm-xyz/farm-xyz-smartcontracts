// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXAsset.sol";
import "../strategies/IXStrategy.sol";
import "./XAssetShareToken.sol";

// todo #1: events
// todo #2: bridge
// todo #3: strategy
// todo #4: base-token
// todo #5: shares
// todo #6: share value conversion in x-base-token
// zapper - conversie automata

contract XAssetBase is IXAsset, Ownable {
    using SafeERC20 for IERC20;

    string public name = "XAssetBase";

    uint256 public totalShares;

    IXStrategy private strategy;

    XAssetShareToken private shareToken;


    mapping(address => mapping(address => uint256)) private _shares;

    /**
     * @dev Emitted when `value` tokens are invested into an XAsset
     */
    event Invest(address indexed from, uint256 amount);

    /**
     * @dev Emitted when `value` tokens are withdrawn from an XAsset
     */
    event Withdraw(address indexed to, uint256 amount);

    /**
     * @param _strategy - The strategy used to manage actions between investment assets
     */
    constructor(IXStrategy _strategy, XAssetShareToken _shareToken) { // todo: move strategy to initialized function, add baseToken
        strategy = _strategy;
        shareToken = _shareToken;
        // todo: ?? mint 100 shares to 0x0

        totalShares = uint256(0);
    }

    // todo: have a createStrategy function that instantiates the strategy with the right params
    // todo: onlyOnwer, can only run once

    function invest(address token, uint256 amount) override public {
        console.log('invest', token, amount);

        // TODO: calculate amount of shares for the user
        // TODO: add shares to the total amount

        _shares[msg.sender][token] = amount;
        totalShares += amount;
    }

    // todo: add estimateSharesForInvestmentAmount(token, amount)

    function withdraw(uint256 amount) override public {
        console.log('withdraw', amount);
    }

    // getSharePrice -> price per 1 share
    // todo: think of how this works if we have 0 shares invested

    // getTVL -> total Value Locked in baseToken -> returned by the strategy

    // getTotalValueOwnedBy(address): total value invested by address in this xAsset, in baseToken

    function getPrice(uint256 amount) override public view returns (uint256) {
        console.log('getPrice', amount);

        return amount;
    }

}
