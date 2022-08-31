// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "hardhat/console.sol";

contract XAssetShareToken is ERC20PermitUpgradeable, OwnableUpgradeable, UUPSUpgradeable {

    function initialize(string memory name_, string memory symbol_) initializer public {
        console.log("XAssetShareToken initialize ", name_, symbol_);
        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
        __Ownable_init();
        __UUPSUpgradeable_init();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // Ownable de catre XAssetBase
    // XAssetBase trebuie sa poata chema mint si burn
    // de implementat mint si burn ca public functions care sunt owner only

    // notes @Florin: modifier `public` sau `internal` ? Pimp: public is fine, internal ar fi accesibila doar din
    // contract
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    // notes @Florin: modifier `public` sau `internal` ?
    function burn(address from, uint256 amount) public onlyOwner {
        _burn(from, amount);
    }
}
