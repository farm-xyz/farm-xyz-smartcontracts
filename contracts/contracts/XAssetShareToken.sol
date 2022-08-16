// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

abstract contract XAssetShareToken is ERC20, Ownable {
    using SafeERC20 for IERC20;

    // Ownable de catre XAssetBase
    // XAssetBase trebuie sa poata chema mint si burn
    // de implementat mint si burn ca public functions care sunt owner only

    function mint(uint256 amount) public onlyOwner {

    }

    function burn(uint256 amount) public onlyOwner {

    }
}
