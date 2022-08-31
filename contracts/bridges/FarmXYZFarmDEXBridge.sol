pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FarmXYZFarmDEXBridge is OwnableUpgradeable, UUPSUpgradeable {

    string public name ;

    /**
     */
    function initialize() initializer external {
        __UUPSUpgradeable_init();

        name = "FarmXYZFarmDEXBridge";
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

}
