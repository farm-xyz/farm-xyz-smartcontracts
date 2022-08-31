// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IXStrategy {

    /**
     * @dev Convert a token amount to assets
     */
    function convert(IERC20Metadata token, uint256 amount) view external returns (uint256);

    /**
     * @dev Returns baseToken amount of all assets owned by the XAsset
     */
    function getTotalAssetValue() external view returns (uint256);

    /**
     * @dev Invests and returns the amount invested, in baseTokens
     */
    function invest(IERC20Metadata token, uint256 amount, int slippage) external returns (uint256);

    /**
     * @dev Calculates the right amount of assets to convert for the amount of baseTokens
     * @return The number of baseToken converted so the xAsset should burn the shares
     */
    function withdraw(uint256 amount, IERC20Metadata toToken, int slippage) external returns (uint256);

    // The strategy has 2 types of investments: a real one and a virtual one.
    // The real investments are the ones that are actually invested in the pool/farm.
    // The virtual investments are the ones that are not invested in the pool/farm, but are used to calculate the
    // price of a share even if no investments were actually made in the XASSET

    /**
     * @return The total value of the virtually invested assets
     */
    function getTotalVirtualAssetValue() external view returns (uint256);

    /**
     * @dev Virtually invest some tokens in the pool/farm, returns the total amount of baseTokens "invested"
     */
    function virtualInvest(uint256 amount) external returns (uint256);

}
