pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
import "./rewardToken.sol";

contract FarmXYZBase {

    mapping(address => uint256) public stakingBalance;
    mapping(address => bool) public isStaking;
    mapping(address => uint256) public startTime;
    mapping(address => uint256) public rewardBalance;

    string public name = "FarmXYZBase";

    IERC20 public stakeToken;
    IERC20 public rewardToken;
    uint256 public minStartTime;
    uint256 public maxStakeTime;
    uint256 public mandatoryLockTime;
    uint16 public earlyReturnAPY;
    uint256 public maturityTime;
    uint16 public maturityAPY;

    event Stake(address indexed from, uint256 amount);
    event Unstake(address indexed from, uint256 amount);
    event YieldWithdraw(address indexed to, uint256 amount);

    /**
     * @param _stakeToken The token users can stake
     * @param _rewardToken The token users get as a reward
     * @param _apy The APY users get for staking percent values 0 and above
    */
    constructor(
        IERC20 _stakeToken,
        IERC20 _rewardToken,
        uint256 _minStartTime,
        uint256 _maxStakeTime,
        uint256 _mandatoryLockTime,
        uint16 _earlyReturnAPY,
        uint256 _maturityTime,
        uint16 _maturityAPY
    ) {
        require(_apy>0, "Can't have 0 APY pool");

        stakeToken = _stakeToken;
        rewardToken = _rewardToken;
        minStartTime = _minStartTime;
        maxStakeTime = _maxStakeTime;
        mandatoryLockTime = _mandatoryLockTime;
        earlyReturnAPY = _earlyReturnAPY;
        maturityTime = _maturityTime;
        maturityAPY = maturityAPY;
    }

    function stake(uint256 amount) public {
        require(amount > 0, "You cannot stake zero tokens");
        require(stakeToken.balanceOf(msg.sender) >= amount, "You don't own enough tokens");

        if(isStaking[msg.sender] == true) {
            console.log("Sender is already staking, calculating current balance and saving state");
            uint256 toTransfer = calculateYieldTotal(msg.sender);
            console.log("Current pending balance", toTransfer);
            rewardBalance[msg.sender] += toTransfer;
        }

        stakeToken.transferFrom(msg.sender, address(this), amount);
        stakingBalance[msg.sender] += amount;
        startTime[msg.sender] = block.timestamp;
        isStaking[msg.sender] = true;
        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 amount) public {
        require(isStaking[msg.sender] == true, "Nothing to unstake");
        require(stakingBalance[msg.sender] >= amount, "Balance is lower than amount");

        uint256 yieldTransfer = calculateYieldTotal(msg.sender);
        startTime[msg.sender] = block.timestamp;
        uint256 balTransfer = amount;
        amount = 0;
        stakingBalance[msg.sender] -= balTransfer;
        stakeToken.transfer(msg.sender, balTransfer);
        rewardBalance[msg.sender] += yieldTransfer;
        if (stakingBalance[msg.sender] == 0) {
            console.log("Sender removed all tokens, setting isStaking to false");
            isStaking[msg.sender] = false;
        }
        emit Unstake(msg.sender, balTransfer);
    }

    /**
     * Returns the number of seconds since the user staked his tokens
     */
    function calculateYieldTime(address user) public view returns(uint256){
        uint256 end = block.timestamp;
        uint256 totalTime = end - startTime[user];
        return totalTime;
    }

    function calculateYieldTotal(address user) public view returns(uint256) {
        uint256 time = calculateYieldTime(user) * 10**18;
        uint256 _yearlyRate = apy * 10**18 ;
        uint256 rate = 86400;
        uint256 timeRate = time / rate;
        uint256 rawYield = (stakingBalance[user] * timeRate) / 10**18;
        return rawYield;
    }

    function withdrawYield() public {
        uint256 toTransfer = calculateYieldTotal(msg.sender);

        require(
            toTransfer > 0 ||
            rewardBalance[msg.sender] > 0,
            "Nothing to withdraw"
        );

        if(rewardBalance[msg.sender] != 0) {
            uint256 oldBalance = rewardBalance[msg.sender];
            rewardBalance[msg.sender] = 0;
            toTransfer += oldBalance;
        }

        startTime[msg.sender] = block.timestamp;
        rewardToken.mint(msg.sender, toTransfer);
        emit YieldWithdraw(msg.sender, toTransfer);
    }
}
