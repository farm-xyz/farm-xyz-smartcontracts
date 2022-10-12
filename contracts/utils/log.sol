pragma solidity ^0.8.0;
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

library log {

    function value(string memory message, uint256 value, uint256 denominator) internal view {
        console.log("%s: %s.%s", message, value / denominator, value % denominator);
    }

    function tokenValue(string memory message, address token, uint256 value) internal view
    {
        uint256 denominator = 10 ** IERC20Metadata(token).decimals();
        console.log("%s: %s.%s", message, value / denominator, value % denominator);
    }

    function balance(string memory message, address token, address holder) internal view
    {
        uint256 denominator = 10 ** IERC20Metadata(token).decimals();
        uint256 value = IERC20Metadata(token).balanceOf(holder);
        console.log("%s: %s.%s", message, value / denominator, value % denominator);
    }
}
