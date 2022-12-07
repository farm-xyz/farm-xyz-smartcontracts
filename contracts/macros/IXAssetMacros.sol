// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../xassets/IXAsset.sol";


interface IXAssetMacros {
    function investIntoXAsset(
        address xAsset,
        address token,
        uint256 amount
    ) external returns (uint256);

    function withdrawFromXAsset(
        address xAsset,
        uint256 shares
    ) external returns (uint256);
}
