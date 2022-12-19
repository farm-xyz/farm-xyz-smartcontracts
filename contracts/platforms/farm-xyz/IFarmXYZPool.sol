// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IFarmXYZPool {
    function stake(address token, uint256 amount) external;
    function unstake(address token, uint256 amount) external;
    function getUserBalance(address user) external view returns (uint256);
    function compoundYield() external;
}
