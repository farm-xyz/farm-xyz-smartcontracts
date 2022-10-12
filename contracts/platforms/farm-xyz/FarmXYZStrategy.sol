// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../strategies/IXStrategy.sol";
import "../../bridges/IXPlatformBridge.sol";
import "../../xassets/IXAsset.sol";
import "./IFarmXYZPool.sol";

contract FarmXYZStrategy is IXStrategy, OwnableUpgradeable, UUPSUpgradeable {
    uint256 constant MAX_UINT256 = 2 ** 256 - 1;

    string public name;

    IXPlatformBridge private _bridge;

    IFarmXYZPool private _farm;
    IERC20Metadata private _baseToken;

    uint256 private _baseTokenDenominator;

    uint256 private _totalValueLocked;

    /**
     * @param bridge - The strategy used to manage actions between investment assets
     * @param farm - The farm used for investing
     * @param baseToken - The base token used for different conversion
     */
    function initialize(IXPlatformBridge bridge,
        IFarmXYZPool farm,
        IERC20Metadata baseToken) initializer external {
        __UUPSUpgradeable_init();

        name = "FarmStrategy";

        _bridge = bridge;
        _farm = farm;
        _baseToken = baseToken;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function invest(IERC20Metadata token, uint256 amount, uint256 expectedBaseTokenAmount, int slippage) override external returns (uint256) {
        require(token.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        if (_baseToken.allowance(address(this), address(_farm)) < amount) {
            _baseToken.approve(address(_farm), amount);
        }
        _farm.stake(amount);
        _totalValueLocked += amount;
        return amount;
    }

    function withdraw(uint256 amount, IERC20Metadata toToken, int slippage) override external returns (uint256) {
        _farm.unstake(amount);
        require(_baseToken.transfer(msg.sender, amount), "ERC20: transfer failed");
        _totalValueLocked -= amount;
        return amount;
    }

    function convert(IERC20Metadata token, uint256 amount) view override public returns (uint256) {
        if (token==_baseToken) {
            return amount;
        }
        revert("Convert not supported yet");
        return 0;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return _farm.getUserBalance(address(this));
    }

    function compound() override external {
        _farm.compoundYield();
    }

}
