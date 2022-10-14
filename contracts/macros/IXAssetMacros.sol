pragma solidity 0.8.4;

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
