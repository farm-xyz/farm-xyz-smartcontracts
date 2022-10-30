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

    function macroTest(
        address xAsset,
        address token,
        uint256 amount
    //        int slippage
    ) external returns (uint256) {
        return 1;
    }


    function investIntoXAsset(
        IXAsset xAsset,
        IERC20 token,
        uint256 amount
    //        int slippage
    ) override external returns (uint256) {
        if (token.allowance(_msgSender(), address(this)) < amount) {
            token.approve(address(this), MAX_INT);
        }
        require(token.transferFrom(_msgSender(), address(this), amount));
        if (token.allowance(address(this), address(xAsset)) < amount) {
            token.approve(address(xAsset), MAX_INT);
        }
        uint256 shares = xAsset.invest(IERC20Metadata(address(token)), amount);
//        require(IXAsset(xAsset).getBaseToken().transfer(msg.sender, baseTokenAmount), "ERC20: transfer failed");
        require(xAsset.shareToken().transfer(_msgSender(), shares), "ERC20: transfer failed");
        return shares;
    }

    function withdrawFromXAsset(
        IXAsset xAsset,
        uint256 shares
    ) override external returns (uint256) {
        uint256 baseTokenAmount = xAsset.withdrawFrom(_msgSender(), shares);
        return baseTokenAmount;
    }


}
