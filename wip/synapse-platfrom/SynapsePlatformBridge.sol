// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "../../bridges/IXPlatformBridge.sol";
import "../../farms/FarmXYZBase.sol";

contract SynapsePlatformBridge is IXPlatformBridge, OwnableUpgradeable, UUPSUpgradeable {

    string public name;

    /**
     */
    function initialize() initializer external {
        __UUPSUpgradeable_init();
        name = "SynapsePlatformBridge";
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}


}
