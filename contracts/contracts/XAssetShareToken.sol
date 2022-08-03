pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract XAssetShareToken is ERC20, Ownable {

    // Ownable de catre XAssetBase
    // XAssetBase trebuie sa poata chema mint si burn
    // de implementat mint si burn ca public functions care sunt owner only

}
