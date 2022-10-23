// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "hardhat/console.sol";

contract XAssetShareToken is ERC20PermitUpgradeable, OwnableUpgradeable, UUPSUpgradeable {

    address private _xAsset;

    function initialize(string memory name_, string memory symbol_) initializer public {
        console.log("XAssetShareToken initialize ", name_, symbol_);
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __Ownable_init();
        __UUPSUpgradeable_init();
        _xAsset = address(0);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function decimals() public view virtual override returns (uint8) {
        return 18;
    }

    // contract
    function mint(address to, uint256 amount) public onlyXAsset {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) public onlyXAsset {
        _burn(from, amount);
    }

    /**
     * @dev Transfers ownership of the contract to a new xAsset (`newXasset`).
     * Can only be called by the current owner.
     */
    function setXAsset(address newXasset) public virtual onlyOwner {
        require(_xAsset == address(0), "XAsset already set");
        require(newXasset != address(0), "xAsset address can not be zero address");
        _xAsset = newXasset;
    }

    /**
     * @dev Throws if called by any account other than the xAsset contract.
     */
    modifier onlyXAsset() {
        _checkXAsset();
        _;
    }

    /**
     * @dev Returns the address of the xAsset contract
     */
    function xAsset() public view virtual returns (address) {
        return _xAsset;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkXAsset() internal view virtual {
        require(xAsset() == _msgSender(), "Caller is not the xAsset contract");
    }
}
