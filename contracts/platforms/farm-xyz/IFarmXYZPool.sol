// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

interface IFarmXYZPool {
    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
    function getUserBalance(address user) external view returns (uint256);
    function compoundYield() external;
}
