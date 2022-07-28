// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXStrategy.sol";
import "../bridges/IXBridge.sol";

contract FarmXYZStrategy is IXStrategy {

    string public name = "FarmXYZStrategy";
    IXBridge private bridge;

    /**
     * @param _bridge - The strategy used to manage actions between investment assets
     */
    constructor(IXBridge _bridge) {
        bridge = _bridge;
    }

    function convert(uint256 amount, address token) override public returns (uint256) {
        console.log('[convert]', amount, token);
        // TODO: handle conversion between token & assets

        return amount;
    }
}
