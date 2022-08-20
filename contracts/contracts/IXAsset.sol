// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IXAsset {

    /**
     * @dev Invest an amount of X-BASE-TOKEN in different assets.
     */
    function invest(IERC20Metadata token, uint256 amount) external;

    /**
     * @dev Withdraws a number of shares from the XASSET
     */
    function withdraw(uint256 amount) external;

    /**
     * @param amount - The amount of shares to calculate the value of
     * @return The value of amount shares in baseToken
     */
    function getValueForShares(uint256 amount) external view returns (uint256);

    /**
     * @return The price per one share of the XASSET
     */
    function getSharePrice() external view returns (uint256);

    /**
     * @return Returns the total amount of baseTokens that are invested in this XASSET
     */
    function getTVL() external view returns (uint256);

    /**
     * @return Total value invested by address in this xAsset, in baseToken
     */
    function getTotalValueOwnedBy(address account) external view returns (uint256);

}
