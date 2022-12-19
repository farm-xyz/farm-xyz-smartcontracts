// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { SafeERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./IFarmXYZPool.sol";

contract FarmInvestableWallet is OwnableUpgradeable, UUPSUpgradeable, IFarmXYZPool {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    uint256 public constant RATE_DENOMINATOR = 10**18;

    mapping(address => uint256) private _stakingBalance;
    mapping(address => mapping(address => uint256)) private _stakingBalancePerToken;
    mapping(address => bool) private _isStaking;
    mapping(address => uint256) private _startTime;
    mapping(address => bool) private _whitelist;

    // We only allow stable tokens to be invested
    mapping(address => bool) private _tokenWhitelist;

    // This will add all the stable tokens invested in the pool
    uint256 public _totalValueDeposited;

    bool private _isWhitelistOnly;

    event Stake(address indexed from, address indexed token, uint256 amount);

    function initialize() initializer external {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _totalValueDeposited = 0;
        _isWhitelistOnly = false;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setWhitelistEnabled(bool whitelistEnabled) public onlyOwner {
        _isWhitelistOnly = whitelistEnabled;
    }

    function addToWhitelist(address[] memory addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _whitelist[addresses[i]] = true;
        }
    }

    function removeFromWhitelist(address[] memory addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _whitelist[addresses[i]] = false;
        }
    }

    function addToTokenWhitelist(address[] memory addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _tokenWhitelist[addresses[i]] = true;
        }
    }

    function removeFromTokenWhitelist(address[] memory addresses) public onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            _tokenWhitelist[addresses[i]] = false;
        }
    }

    function totalValueDeposited() public view returns (uint256) {
        return _totalValueDeposited;
    }

    function isStaking(address user) public view returns (bool) {
        return _isStaking[user];
    }

    function startTime(address user) public view returns (uint256) {
        return _startTime[user];
    }

    function getUserBalance(address user) override external view returns (uint256) {
        return _stakingBalance[user];
    }

    function getUserTokenBalance(address token, address user) external view returns (uint256) {
        return _stakingBalancePerToken[token][user];
    }

    function stake(address token, uint256 amount) override external {
        require(amount > 0, "You cannot stake zero tokens");
        require(IERC20Upgradeable(token).balanceOf(msg.sender) >= amount, "Can't stake: You don't own enough tokens");
        require(!_isWhitelistOnly || _whitelist[msg.sender], "You are not whitelisted");
        require(_tokenWhitelist[token], "Token is not whitelisted");

        IERC20Upgradeable(token).safeTransferFrom(msg.sender, address(this), amount);
        _stakingBalance[msg.sender] += amount;
        _stakingBalancePerToken[msg.sender][token] += amount;
        _totalValueDeposited += amount;
        _startTime[msg.sender] = block.timestamp;
        _isStaking[msg.sender] = true;
        emit Stake(msg.sender, token, amount);
    }

    function _unstake(address owner, uint256 amount) private {
        revert("Unstake not allowed, all investments are final");
    }

    function unstake(address token, uint256 amount) override external {
        _unstake(msg.sender, amount);
    }

    // Allow owner to withdraw tokens from the contract
    function withdraw(address token, uint256 amount) public onlyOwner {
        require(amount > 0, "You cannot withdraw zero tokens");
        require(IERC20Upgradeable(token).balanceOf(address(this)) >= amount, "Can't withdraw: You don't own enough tokens");

        IERC20Upgradeable(token).safeTransfer(msg.sender, amount);
    }

    function compoundYield() override external {
    }

}
