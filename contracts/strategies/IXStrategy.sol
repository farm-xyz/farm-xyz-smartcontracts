// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

interface IXStrategy {

    /**
     * @dev Convert a token amount to assets
     */
    function convert(address token, uint256 amount) view external returns (uint256);

    /**
     * @dev Returns baseToken amount of all assets owned by the XAsset
     */
    function getTotalAssetValue() external returns (uint256);

    /**
     * @dev Invests and returns the amount invested, in baseTokens
     */
    function invest(address token, uint256 amount, int slippage) external returns (uint256);

    /**
     * @dev Calculates the right amount of assets to convert for the amount of baseTokens
     * Returns the number of baseToken converted so the xAsset should burn the shares
     */
    function withdraw(address baseToken, uint256 amount, address toToken, int slippage) external returns (uint256);

}
