// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXAsset.sol";
import "../strategies/IXStrategy.sol";

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
    constructor(IXStrategy _strategy) {
        strategy = _strategy;

        totalShares = uint256(0);
    }

    function invest(uint256 amount, address token) override public {
        console.log('invest', amount, token);

        // TODO: calculate amount of shares for the user
        // TODO: add shares to the total amount

        _shares[msg.sender][token] = amount;
        totalShares += amount;
    }

    function withdraw(uint256 amount) override public {
        console.log('withdraw', amount);
    }

    function getPrice(uint256 amount) override public view returns (uint256) {
        console.log('getPrice', amount);

        return amount;
    }

}
