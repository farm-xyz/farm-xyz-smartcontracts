// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

library log {

    function value(string memory message, uint256 val, uint256 denominator) internal view {
        console.log("%s: %s.%s", message, val / denominator, val % denominator);
    }

    function tokenValue(string memory message, address token, uint256 val) internal view
    {
        uint256 denominator = 10 ** IERC20Metadata(token).decimals();
        console.log("%s: %s.%s", message, val / denominator, val % denominator);
    }

    function balance(string memory message, address token, address holder) internal view
    {
        uint256 denominator = 10 ** IERC20Metadata(token).decimals();
        uint256 val = IERC20Metadata(token).balanceOf(holder);
        console.log("%s: %s.%s", message, val / denominator, val % denominator);
    }
}
