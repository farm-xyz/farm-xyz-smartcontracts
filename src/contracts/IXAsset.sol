// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IXAsset {

    /**
     * @dev Invest an amount of X-BASE-TOKEN in different assets.
     */
    function invest(uint256 amount) public;

    /**
     * @dev Withdraws a number of shares from the XASSET
     */
    function withdraw(uint256 amount) public;

    /**
     * @dev Returns the total shares price, in X-BASE-TOKEN value
     */
    function getPrice(uint256 amount) public;

}
