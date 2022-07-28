// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IXStrategy {

    /**
     * @dev Convert a token amount to assets
     */
    function convert(uint256 amount, address token) external returns (uint256);

}
