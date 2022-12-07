// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../../bridges/IXPlatformBridge.sol";

contract FarmXYZPlatformBridge is IXPlatformBridge, OwnableUpgradeable, UUPSUpgradeable {

    string public name;

    /**
     */
    function initialize() initializer external {
        __UUPSUpgradeable_init();
        name = "FarmXYZPlatformBridge";
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}


}
