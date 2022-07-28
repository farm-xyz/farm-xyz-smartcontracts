// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./IXBridge.sol";
import "../FarmXYZBase.sol";

contract FarmXYZBridge is IXBridge {

    string public name = "FarmXYZBridge";

    FarmXYZBase private farmXYZ;

    /**
     * @param _farmXYZ - The FarmXYZ contract
     */
    constructor(
        FarmXYZBase _farmXYZ
    ) {
        farmXYZ = _farmXYZ;
    }
}
