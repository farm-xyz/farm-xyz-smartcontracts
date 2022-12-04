pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICakePool {

    struct UserInfo {
        uint256 shares; // number of shares for a user.
        uint256 lastDepositedTime; // keep track of deposited time for potential penalty.
        uint256 cakeAtLastUserAction; // keep track of cake deposited at the last user action.
        uint256 lastUserActionTime; // keep track of the last user action time.
        uint256 lockStartTime; // lock start time.
        uint256 lockEndTime; // lock end time.
        uint256 userBoostedShare; // boost share, in order to give the user higher reward. The user only enjoys the reward, so the principal needs to be recorded as a debt.
        bool locked; //lock status.
        uint256 lockedAmount; // amount deposited during lock period.
    }

    IERC20 public immutable token; // cake token.

    address public boostContract; // boost contract used in Masterchef.
    address public VCake;

    mapping(address => UserInfo) public userInfo;
    mapping(address => bool) public freePerformanceFeeUsers; // free performance fee users.
    mapping(address => bool) public freeWithdrawFeeUsers; // free withdraw fee users.
    mapping(address => bool) public freeOverdueFeeUsers; // free overdue fee users.

    uint256 public totalShares;
    address public admin;
    address public treasury;
    address public operator;
    uint256 public cakePoolPID;
    uint256 public totalBoostDebt; // total boost debt.
    uint256 public totalLockedAmount; // total lock amount.

    uint256 public constant MAX_PERFORMANCE_FEE; // 20%
    uint256 public constant MAX_WITHDRAW_FEE; // 5%
    uint256 public constant MAX_OVERDUE_FEE; // 100%
    uint256 public constant MAX_WITHDRAW_FEE_PERIOD; // 1 week
    uint256 public constant MIN_LOCK_DURATION; // 1 week
    uint256 public constant MAX_LOCK_DURATION_LIMIT; // 1000 days
    uint256 public constant BOOST_WEIGHT_LIMIT; // 5000%
    uint256 public constant PRECISION_FACTOR; // precision factor.
    uint256 public constant PRECISION_FACTOR_SHARE; // precision factor for share.
    uint256 public constant MIN_DEPOSIT_AMOUNT;
    uint256 public constant MIN_WITHDRAW_AMOUNT;
    uint256 public UNLOCK_FREE_DURATION; // 1 week
    uint256 public MAX_LOCK_DURATION; // 365 days
    uint256 public DURATION_FACTOR; // 365 days, in order to calculate user additional boost.
    uint256 public DURATION_FACTOR_OVERDUE; // 180 days, in order to calculate overdue fee.
    uint256 public BOOST_WEIGHT; // 100%

    uint256 public performanceFee; // 2%
    uint256 public performanceFeeContract; // 2%
    uint256 public withdrawFee; // 0.1%
    uint256 public withdrawFeeContract; // 0.1%
    uint256 public overdueFee; // 100%
    uint256 public withdrawFeePeriod; // 3 days

    event Deposit(address indexed sender, uint256 amount, uint256 shares, uint256 duration, uint256 lastDepositedTime);
    event Withdraw(address indexed sender, uint256 amount, uint256 shares);
    event Harvest(address indexed sender, uint256 amount);
    event Pause();
    event Unpause();
    event Init();
    event Lock(
        address indexed sender,
        uint256 lockedAmount,
        uint256 shares,
        uint256 lockedDuration,
        uint256 blockTimestamp
    );
    event Unlock(address indexed sender, uint256 amount, uint256 blockTimestamp);
    event NewAdmin(address admin);
    event NewTreasury(address treasury);
    event NewOperator(address operator);
    event NewBoostContract(address boostContract);
    event NewVCakeContract(address VCake);
    event FreeFeeUser(address indexed user, bool indexed free);
    event NewPerformanceFee(uint256 performanceFee);
    event NewPerformanceFeeContract(uint256 performanceFeeContract);
    event NewWithdrawFee(uint256 withdrawFee);
    event NewOverdueFee(uint256 overdueFee);
    event NewWithdrawFeeContract(uint256 withdrawFeeContract);
    event NewWithdrawFeePeriod(uint256 withdrawFeePeriod);
    event NewMaxLockDuration(uint256 maxLockDuration);
    event NewDurationFactor(uint256 durationFactor);
    event NewDurationFactorOverdue(uint256 durationFactorOverdue);
    event NewUnlockFreeDuration(uint256 unlockFreeDuration);
    event NewBoostWeight(uint256 boostWeight);


    /**
     * @notice Unlock user cake funds.
     * @dev Only possible when contract not paused.
     * @param _user: User address
     */
    function unlock(address _user) external;

    /**
     * @notice Deposit funds into the Cake Pool.
     * @dev Only possible when contract not paused.
     * @param _amount: number of tokens to deposit (in CAKE)
     * @param _lockDuration: Token lock duration
     */
    function deposit(uint256 _amount, uint256 _lockDuration) external;

    /**
     * @notice Withdraw funds from the Cake Pool.
     * @param _amount: Number of amount to withdraw
     */
    function withdrawByAmount(uint256 _amount) public;

    /**
     * @notice Withdraw funds from the Cake Pool.
     * @param _shares: Number of shares to withdraw
     */
    function withdraw(uint256 _shares) public;

    /**
     * @notice Withdraw all funds for a user
     */
    function withdrawAll() external;


    /**
     * @notice Calculate Performance fee.
     * @param _user: User address
     * @return Returns Performance fee.
     */
    function calculatePerformanceFee(address _user) public view returns (uint256);

    /**
     * @notice Calculate overdue fee.
     * @param _user: User address
     * @return Returns Overdue fee.
     */
    function calculateOverdueFee(address _user) public view returns (uint256);

    /**
     * @notice Calculate Performance Fee Or Overdue Fee
     * @param _user: User address
     * @return Returns  Performance Fee Or Overdue Fee.
     */
    function calculatePerformanceFeeOrOverdueFee(address _user) internal view returns (uint256);

    /**
     * @notice Calculate withdraw fee.
     * @param _user: User address
     * @param _shares: Number of shares to withdraw
     * @return Returns Withdraw fee.
     */
    function calculateWithdrawFee(address _user, uint256 _shares) public view returns (uint256);

    /**
     * @notice Calculates the total pending rewards that can be harvested
     * @return Returns total pending cake rewards
     */
    function calculateTotalPendingCakeRewards() public view returns (uint256);

    function getPricePerFullShare() external view returns (uint256);
    /**
     * @notice Current pool available balance
     * @dev The contract puts 100% of the tokens to work.
     */
    function available() public view returns (uint256);

    /**
     * @notice Calculates the total underlying tokens
     * @dev It includes tokens held by the contract and the boost debt amount.
     */
    function balanceOf() public view returns (uint256);
}