pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../xassets/IXAsset.sol";


interface IXAssetMacros {
    function investIntoXAsset(
        IXAsset xAsset,
        IERC20 token,
        uint256 amount
    ) external returns (uint256);

    function withdrawFromXAsset(
        IXAsset xAsset,
        uint256 shares
    ) external returns (uint256);
}
