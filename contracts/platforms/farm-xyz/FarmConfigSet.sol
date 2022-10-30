pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FarmConfigSet is OwnableUpgradeable, UUPSUpgradeable {

    mapping(address => uint256) private _returnsPeriods;

    struct FarmConfig {
        address farm;
        uint256 returnsPeriod;
    }

    function initialize() initializer external {
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setReturnsPeriod(address farm, uint256 returnsPeriod) public {
        if (_msgSender() != farm) {
            require(owner() == _msgSender(), "Ownable: caller is not the owner");
        }

        _returnsPeriods[farm] = returnsPeriod;
    }

    function getReturnsPeriod(address farm) public view returns (uint256) {
        return _returnsPeriods[farm];
    }

    function loadConfigs(FarmConfig[] memory configs) public onlyOwner {
        for (uint256 i = 0; i < configs.length; i++) {
            _returnsPeriods[configs[i].farm] = configs[i].returnsPeriod;
        }
    }

}
