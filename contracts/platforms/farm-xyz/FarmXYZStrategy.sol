// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuardUpgradeable } from '@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol';
import { PausableUpgradeable } from '@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol';

import "../../strategies/IXStrategy.sol";
import "../../bridges/IXPlatformBridge.sol";
import "../../xassets/IXAsset.sol";
import "./IFarmXYZPool.sol";

contract FarmXYZStrategy is IXStrategy, ReentrancyGuardUpgradeable, PausableUpgradeable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 constant MAX_UINT256 = 2 ** 256 - 1;

    string public name;

    address public xAsset;

    IXPlatformBridge private _bridge;

    IFarmXYZPool private _farm;
    IERC20Metadata private _baseToken;

    uint256 private _baseTokenDenominator;

    /**
     * @param bridge - The strategy used to manage actions between investment assets
     * @param farm - The farm used for investing
     * @param baseToken - The base token used for different conversion
     */
    function initialize(
        IXPlatformBridge bridge,
        IFarmXYZPool farm,
        IERC20Metadata baseToken
    ) initializer external {
        __UUPSUpgradeable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        name = "FarmStrategy";

        _bridge = bridge;
        _farm = farm;
        _baseToken = baseToken;
        _baseTokenDenominator = 10 ** _baseToken.decimals();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function invest(
        address token,
        uint256 amount,
        uint256 minAmount
    ) nonReentrant whenNotPaused onlyXAsset override external returns (uint256) {
        require(amount>=minAmount, "FarmXYZStrategy: amount is less than minAmount"); // silence unused param warning
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        if (IERC20(token).allowance(address(this), address(_farm)) < amount) {
            IERC20(token).approve(address(_farm), amount);
        }
        _farm.stake(token, amount);

        return amount;
    }

    function withdraw(
        uint256 amount,
        uint256 minAmount
    ) nonReentrant whenNotPaused onlyXAsset override external returns (uint256) {
        uint256 balanceBefore = IERC20(_baseToken).balanceOf(address(this));
        _farm.unstake(address(_baseToken), amount);
        uint256 balanceAfter = IERC20(_baseToken).balanceOf(address(this));
        uint256 balance = balanceAfter - balanceBefore;
        require(balance >= minAmount, "FarmXYZStrategy: balance is less than minAmount");
        require(_baseToken.transfer(msg.sender, amount), "ERC20: transfer failed");
        return amount;
    }

    function convert(address token, uint256 amount) view override public returns (uint256) {
        require(token == address(_baseToken), "FarmStrategy: only support base token");
        return amount;
    }

    // getTotalAssetValue() -> returns baseToken amount of all assets owned by the XAsset
    function getTotalAssetValue() override view external returns (uint256) {
        return _farm.getUserBalance(address(this));
    }

    function compound() nonReentrant whenNotPaused override external {
        _farm.compoundYield();
    }

    /**
     * @notice pause strategy, restricting certain operations
     */
    function pause() external nonReentrant onlyOwner {
        _pause();
    }

    /**
     * @notice unpause strategy, enabling certain operations
     */
    function unpause() external nonReentrant onlyOwner {
        _unpause();
    }

    /**
     * @dev Transfers ownership of the contract to a new xAsset (`newXasset`).
     * Can only be called by the current owner.
     */
    function setXAsset(address newXasset) public virtual onlyOwner {
        require(newXasset != address(0), "xAsset address can not be zero address");
        xAsset = newXasset;
    }

    /**
     * @dev Throws if called by any account other than the xAsset contract.
     */
    modifier onlyXAsset() {
        _checkXAsset();
        _;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkXAsset() internal view virtual {
        require(xAsset == _msgSender(), "Caller is not the xAsset contract");
    }

}
