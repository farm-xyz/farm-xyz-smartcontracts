// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "../xassets/IXAsset.sol";
import "./IXAssetMacros.sol";

contract XAssetMacros is Ownable, IXAssetMacros {

    uint256 constant MAX_INT = 2 ** 256 - 1;

    function investIntoXAsset(
        address xAsset,
        address token,
        uint256 amount
    //        int slippage
    ) override external returns (uint256) {
        if (IERC20(token).allowance(_msgSender(), address(this)) < amount) {
            IERC20(token).approve(address(this), MAX_INT);
        }
        require(IERC20(token).transferFrom(_msgSender(), address(this), amount));
        if (IERC20(token).allowance(address(this), xAsset) < amount) {
            IERC20(token).approve(xAsset, MAX_INT);
        }
        return IXAsset(xAsset).invest(IERC20Metadata(token), amount);
    }

    function withdrawFromXAsset(
        address xAsset,
        uint256 shares
    ) override external returns (uint256) {
        uint256 baseTokenAmount = IXAsset(xAsset).withdraw(shares);
        require(IXAsset(xAsset).getBaseToken().transfer(msg.sender, baseTokenAmount), "ERC20: transfer failed");
        return baseTokenAmount;
    }


}
