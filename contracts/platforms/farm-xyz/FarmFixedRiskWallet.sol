// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./IFarmXYZPool.sol";
//import "hardhat/console.sol";
//import "../../utils/log.sol";

contract FarmFixedRiskWallet is OwnableUpgradeable, UUPSUpgradeable, IFarmXYZPool {

    uint256 public constant RATE_DENOMINATOR = 10**18;

    mapping(address => uint256) private _stakingBalance;
    mapping(address => bool) private _isStaking;
    mapping(address => uint256) private _startTime;
    mapping(address => bool) private _whitelist;

    uint256 public _totalValueDeposited;
    uint256 public _totalReturnsDeposited;
    uint256 private _returnsPaybackPeriod;

    bool private _isWhitelistOnly;

    IERC20 public _token;

    event Stake(address indexed from, uint256 amount);
    event Unstake(address indexed from, uint256 amount);
    event YieldCompound(address indexed to, uint256 amount);

    /**
     * @param token - The token users can stake
    */
    function initialize(IERC20 token) initializer external {
        __Ownable_init();
        __UUPSUpgradeable_init();

        _token = token;
        _totalValueDeposited = 0;
        _returnsPaybackPeriod = 62 days;
        _isWhitelistOnly = false;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setPaybackPeriod(uint256 paybackPeriod) public onlyOwner {
        _returnsPaybackPeriod = paybackPeriod;
    }

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

    function totalReturnsDeposited() public view returns (uint256) {
        return _totalReturnsDeposited;
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

    function stakingBalance(address user) public view returns (uint256) {
        return _stakingBalance[user];
    }

    function _getUserBalance(address user) private view returns (uint256) {
        return _stakingBalance[user] + calculateYieldTotal(user);
    }

    function getUserBalance(address user) override external view returns (uint256) {
        return _getUserBalance(user);
    }

    function depositToReturnsPool(uint256 amount) public {
        require(_token.balanceOf(msg.sender) >= amount, "Can't deposit returns: you don't own enough tokens");
        require(_token.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        _totalReturnsDeposited +=amount;
    }

    function withdrawFromReturnsPool(uint256 amount) public onlyOwner {
        require(_token.balanceOf(address(this)) >= amount, "There aren't enough tokens in the pool");
        require(_token.transfer(msg.sender, amount), "ERC20: transfer failed");
        _totalReturnsDeposited -=amount;
    }

    function stake(uint256 amount) override external {
        require(amount > 0, "You cannot stake zero tokens");
        require(_token.balanceOf(msg.sender) >= amount, "Can't stake: You don't own enough tokens");
        require(!_isWhitelistOnly || _whitelist[msg.sender], "You are not whitelisted");

        if (_isStaking[msg.sender] == true) {
            _compoundYieldFor(msg.sender);
        }

        require(_token.transferFrom(msg.sender, address(this), amount), "ERC20: transferFrom failed");
        _stakingBalance[msg.sender] += amount;
        _totalValueDeposited += amount;
        _startTime[msg.sender] = block.timestamp;
        _isStaking[msg.sender] = true;
        emit Stake(msg.sender, amount);
    }

    function unstakeAll() public
    {
        require(_isStaking[msg.sender] == true, "Nothing to unstake");
        _unstake(msg.sender, _getUserBalance(msg.sender));
    }

    function _unstake(address owner, uint256 amount) private {
        require(_isStaking[owner] == true, "Nothing to unstake");

        // Let's compoundYield first
        _compoundYieldFor(owner);

//        log.tokenValue("[unstake] balance after compound", address(_token), _stakingBalance[owner]);
//        log.tokenValue("[unstake] unstake amount", address(_token), amount);

        require(_stakingBalance[owner] >= amount, "Balance is lower than amount");
        uint256 balTransfer = amount;
        amount = 0;
        _stakingBalance[owner] -= balTransfer;
        _totalValueDeposited -= balTransfer;
        require(_token.transfer(owner, balTransfer), "ERC20: transfer failed");
        if (_stakingBalance[owner] == 0) {
            _isStaking[owner] = false;
        }
        emit Unstake(owner, balTransfer);
    }

    function unstake(uint256 amount) override external {
        _unstake(msg.sender, amount);
    }

    function calculateRatePerSecond() internal view returns (uint256) {
        return RATE_DENOMINATOR * _totalReturnsDeposited / _returnsPaybackPeriod / _totalValueDeposited;
    }

    /**
     * Returns the number of seconds since the user staked his tokens
     */
    function calculateYieldTime(address user) public view returns (uint256) {
        if (!_isStaking[user]) {
            return 0;
        }
        uint256 end = block.timestamp;
        uint256 totalTime = end - _startTime[user];
        return totalTime;
    }

    function calculateYieldTotal(address user) public view returns (uint256) {
        if (!_isStaking[user]) {
            return 0;
        }
        uint256 time = calculateYieldTime(user);
        uint256 totalReturnRate = calculateRatePerSecond();
        uint256 userReturnRate = totalReturnRate * _stakingBalance[user];
        uint256 rawYield = userReturnRate * time / RATE_DENOMINATOR;
        return rawYield;
    }

    function _compoundYieldFor(address owner) private {
//        console.log("[cY] Compounding yield for", owner);
        uint256 toTransfer = 0;
        uint256 currentPeriodYield = calculateYieldTotal(owner);

        toTransfer += currentPeriodYield;

        if (toTransfer == 0) {
            return;
        }
//        log.tokenValue("[cY] compounding", address(_token), toTransfer);
        require(_totalReturnsDeposited >= toTransfer, "There aren't enough returns deposited in the pool");
        _startTime[msg.sender] = block.timestamp;
        _totalReturnsDeposited -= toTransfer;

        _stakingBalance[msg.sender] += toTransfer;
        _totalValueDeposited += toTransfer;
//        log.tokenValue("[cY] new balance", address(_token), _stakingBalance[msg.sender]);
//        log.tokenValue("[cY] _totalReturnsDeposited", address(_token), _totalReturnsDeposited);
//        log.tokenValue("[cY] _totalValueDeposited", address(_token), _totalValueDeposited);

        emit YieldCompound(msg.sender, toTransfer);
    }

    function compoundYield() override external {
        _compoundYieldFor(msg.sender);
    }

}
