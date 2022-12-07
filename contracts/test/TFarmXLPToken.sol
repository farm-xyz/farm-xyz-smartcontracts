// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TFarmXLPToken is ERC20, Ownable {

    constructor() ERC20("TFarmXLPToken", "TFARMXLP") {

    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

}
