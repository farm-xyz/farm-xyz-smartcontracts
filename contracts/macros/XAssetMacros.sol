// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "../xassets/IXAsset.sol";
import "./IXAssetMacros.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract XAssetMacros is Ownable, IXAssetMacros {
    using SafeERC20 for IERC20;

    function investIntoXAsset(
        address xAsset,
        address token,
        uint256 amount
    ) override external returns (uint256) {
        // Transfer tokens from the user to the proxy
        IERC20(token).safeTransferFrom(_msgSender(), address(this), amount);

        // Allow the xAsset to spend the tokens
        if (IERC20(token).allowance(address(this), xAsset) < amount) {
            IERC20(token).safeIncreaseAllowance(xAsset, type(uint256).max);
        }

        // Invest the tokens into the xAsset
        uint256 shares = IXAsset(xAsset).invest(token, amount);

        // Transfer the shares to the user's wallet
        IERC20(IXAsset(xAsset).shareToken()).safeTransfer(_msgSender(), shares);
        return shares;
    }

    function withdrawFromXAsset(
        address xAsset,
        uint256 shares
    ) override external returns (uint256) {
        // We don't need to transfer the shares to the proxy because the xAsset
        // will burn them directly and check the right balance
        uint256 baseTokenAmount = IXAsset(xAsset).withdrawFrom(_msgSender(), shares);
        // We don't need to transfer tokens to the owner because the xAsset
        // will send them directly to the owner
        return baseTokenAmount;
    }


}
