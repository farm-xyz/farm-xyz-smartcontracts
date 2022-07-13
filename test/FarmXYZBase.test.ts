import {FarmXYZBase, RFarmXToken, TFarmXToken} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {snapshot, time} from '@openzeppelin/test-helpers';
import {fail} from "assert";

describe("Farm XYZ", async () => {
  const _apy: number = 120;  // percentage > 0
  const totalRewardPool: BigNumber = ethers.utils.parseEther("1000000");
  const totalStakePool: BigNumber = ethers.utils.parseEther("500000");
  const totalUserBalance: BigNumber = ethers.utils.parseEther("100000");

  let rewardToken: RFarmXToken;
  let stakeToken: TFarmXToken;
  let farmXYZ: FarmXYZBase;
  let owner: SignerWithAddress;
  let john: SignerWithAddress;
  let alice: SignerWithAddress;

  function calculateRatePerSecond() {
    return BigNumber.from(_apy).mul(BigNumber.from("10").pow(18)).div(BigNumber.from(100)).div(BigNumber.from(365 * 24 * 3600));
  }

  function calculateCorrectYield(time: number, staked: BigNumber) {
    const stakeTime = BigNumber.from(time);
    const ratePerSecond = calculateRatePerSecond();

    return ratePerSecond.mul(staked).mul(stakeTime).div(BigNumber.from("10").pow(18));
  }

  async function calculateNextBlockYield(timeStaked: number, staked: BigNumber) {
    const blockSnapshot = await snapshot();
    await time.advanceBlock();
    const expectedYield = calculateCorrectYield(timeStaked, staked);
    const availableYield = await farmXYZ.calculateYieldTotal(john.address);
    await blockSnapshot.restore();

    return {expectedYield, availableYield};
  }

  async function stakeInFarm(user: SignerWithAddress, amount: BigNumber) {
    await rewardToken.transferOwnership(farmXYZ.address);
    await stakeToken.connect(user).approve(farmXYZ.address, amount);
    await farmXYZ.connect(user).stake(amount);
  }

  beforeEach(async () => {
    const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
    const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
    const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");

    rewardToken = await RFarmXToken.deploy();
    stakeToken = await TFarmXToken.deploy();
    await Promise.all([
      rewardToken.deployed(),
      stakeToken.deployed(),
    ]);

    farmXYZ = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);
    await farmXYZ.deployed();

    [owner, john, alice] = await ethers.getSigners();

    await Promise.all([
      rewardToken.mint(owner.address, totalRewardPool),
      stakeToken.mint(john.address, totalUserBalance),
      stakeToken.mint(alice.address, totalUserBalance),
    ])
  })

  describe('Setup', () => {
    it("should initialize", async () => {
      expect(rewardToken).to.be.ok;
      expect(stakeToken).to.be.ok;
      expect(farmXYZ).to.be.ok;
    })
  })

  describe('Rewards', async () => {
    it('should calculate total value locked', async () => {
      const stakeAmount = ethers.utils.parseEther("100");
      const timeStaked = 24 * 3600;

      expect(await farmXYZ.totalValueLocked()).to.eq(0);

      // a user stake's an amount
      await rewardToken.transferOwnership(farmXYZ.address);
      await stakeToken.connect(john).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(john).stake(stakeAmount);

      expect(await farmXYZ.totalValueLocked()).to.eq(stakeAmount);

      // another use stake's an amount
      await stakeToken.connect(alice).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(alice).stake(stakeAmount);

      expect(await farmXYZ.totalValueLocked()).to.eq(stakeAmount.add(stakeAmount));
    });

    it('should return total rewards per day', async () => {
      const ratePerDay = calculateRatePerSecond().mul(24 * 3600);
      const stakeAmount = ethers.utils.parseEther("100");

      // stake an initial sum
      await rewardToken.transferOwnership(farmXYZ.address);
      await stakeToken.connect(john).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(john).stake(stakeAmount);
      await stakeToken.connect(alice).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(alice).stake(stakeAmount);

      expect(await farmXYZ.rewardsPerDay()).to.eq(stakeAmount.mul(2).mul(ratePerDay));

      // unstake an amount from pool
      await farmXYZ.connect(john).unstake(stakeAmount);

      expect(await farmXYZ.rewardsPerDay()).to.eq(stakeAmount.mul(ratePerDay));
    });

    it('should deposit rewards to reward pool', async () => {
      await rewardToken.connect(owner).approve(farmXYZ.address, totalRewardPool);
      await farmXYZ.connect(owner).depositToRewardPool(totalRewardPool);

      expect(await farmXYZ.totalRewardPool())
          .to.eq(totalRewardPool)
    })
  })

  describe('Stake', async () => {
    it('should approve transfer and stake amount', async () => {
      let stakeAmount = ethers.utils.parseEther("100");

      expect(await farmXYZ.stakingBalance(john.address))
          .to.eq(0);

      await rewardToken.transferOwnership(farmXYZ.address);
      await stakeToken.connect(john).approve(farmXYZ.address, stakeAmount);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);

      expect(await farmXYZ.connect(john).stake(stakeAmount))
          .to.be.ok;

      expect(await farmXYZ.stakingBalance(john.address))
          .to.eq(stakeAmount);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(true);
    });
  })

  describe('Unstake', async () => {
    const stakeAmount = ethers.utils.parseEther("100");

    beforeEach(async () => {
      await stakeToken.connect(john).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(john).stake(stakeAmount);
    })

    it('should unstake balance from user', async () => {
      expect(await farmXYZ.isStaking(john.address))
          .to.eq(true);

      await farmXYZ.connect(john).unstake(stakeAmount);

      expect(await farmXYZ.stakingBalance(john.address))
          .to.eq(0);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);
    })

    it("should update yield balance when unstaked", async () => {
      const unstakeAmount = ethers.utils.parseEther("5");
      await time.increase(86400);
      await farmXYZ.connect(john).unstake(unstakeAmount);

      expect(await farmXYZ.stakingBalance(john.address))
          .to.be.eq(stakeAmount.sub(unstakeAmount));
    })
  })

  describe('Yield', async () => {
    it('should return correct yield time', async () => {
      // when there is no action made by the user the start time is not set
      expect((await farmXYZ.startTime(john.address)).toNumber())
          .to.be.eq(0);

      // when staking start time should be updated
      await stakeInFarm(john, ethers.utils.parseEther("100"));
      expect((await farmXYZ.startTime(john.address)).toNumber())
          .to.be.eq((await time.latest()).toNumber());

      // Fast-forward time
      const timeStaked = 24 * 3600;
      await time.increase(timeStaked);

      const yieldTime = await farmXYZ.calculateYieldTime(john.address);
      expect(yieldTime.toNumber()).to.eq(timeStaked)
    })

    it('should calculate correct yield', async () => {
      let amount = ethers.utils.parseEther("100");

      await rewardToken.transferOwnership(farmXYZ.address);
      await stakeToken.connect(john).approve(farmXYZ.address, amount);
      await farmXYZ.connect(john).stake(amount);

      let availableYield: BigNumber;
      let staked = await farmXYZ.stakingBalance(john.address)

      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked)
      availableYield = await farmXYZ.calculateYieldTotal(john.address)
      let expectedYield = calculateCorrectYield(timeStaked, staked);

      expect(availableYield).to.eq(expectedYield);
    });
  })

  describe('Withdraw yield validation', async () => {
    it("should receive error when withdrawing no balance or rewards", async () => {
      let staked = await farmXYZ.stakingBalance(john.address)
      let rewards = await farmXYZ.rewardBalance(john.address)

      expect(staked).to.eq(0);
      expect(rewards).to.eq(0);

      try {
        await farmXYZ.connect(john).withdrawYield(false);
        fail('Failed to throw an error and cancel the transaction.');
      } catch (e: any) {
        expect(e.message).to.eq("VM Exception while processing transaction: reverted with reason string 'Nothing to withdraw'");
      }
    })
  })

  describe('Harvest withdrawal', async () => {
    beforeEach(async () => {
      // deposit rewards
      await rewardToken.connect(owner).approve(farmXYZ.address, totalRewardPool);
      await farmXYZ.connect(owner).depositToRewardPool(totalRewardPool);
    })

    it('should be able to harvest yield after staking', async () => {
      // stake an amount into the pool
      expect(await farmXYZ.stakingBalance(john.address)).to.eq(0);
      let stakeAmount = ethers.utils.parseEther("100");
      await stakeInFarm(john, stakeAmount);

      // save initial parameters
      let initialStaked = await farmXYZ.stakingBalance(john.address);
      let initialRewards = await farmXYZ.rewardBalance(john.address);
      let initialBalance = await john.getBalance();
      let initialRewardPool = await farmXYZ.totalRewardPool();

      expect(initialStaked).to.eq(stakeAmount);

      // some time is passing
      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked);

      const {expectedYield, availableYield} = await calculateNextBlockYield(timeStaked + 1, initialStaked);

      expect(expectedYield).to.eq(availableYield);

      console.log('before-withdraw', {initialStaked, initialRewards, initialBalance, initialRewardPool, expectedYield, availableYield});

      // withdraw with harvest flag set
      await farmXYZ.connect(john).withdrawYield(false);

      let currentStaked = await farmXYZ.stakingBalance(john.address);
      let currentRewards = await farmXYZ.rewardBalance(john.address);
      let currentBalance = await john.getBalance();
      let currentRewardPool = await farmXYZ.totalRewardPool();
      const expectedBalance = initialBalance.add(expectedYield);

      console.log('after-withdraw', {currentStaked, currentRewards, initialBalance, expectedBalance, currentBalance, currentRewardPool});

      expect(currentStaked).to.eq(initialStaked);
      expect(currentRewards).to.eq(0);
      // expect(currentBalance).to.eq(initialBalance.add(expectedYield));
      expect(currentRewardPool).to.eq(initialRewardPool.sub(expectedYield));
    })
  })

  describe('Compound withdrawal', async () => {
    beforeEach(async () => {
      // deposit rewards
      await rewardToken.connect(owner).approve(farmXYZ.address, totalRewardPool);
      await farmXYZ.connect(owner).depositToRewardPool(totalRewardPool);
    })

    it('should be able to withdraw compound yield after staking', async () => {
      // stake an amount into the pool
      await stakeInFarm(john, ethers.utils.parseEther("100"));

      // save initial balance
      let stakingBalance = await farmXYZ.stakingBalance(john.address);
      let rewardBalance = await farmXYZ.rewardBalance(john.address);

      // some time is passing
      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked);

      const {expectedYield, availableYield} = await calculateNextBlockYield(timeStaked + 1, stakingBalance);

      expect(availableYield).to.eq(expectedYield);

      // withdraw with compound flag set
      await farmXYZ.connect(john).withdrawYield(true);

      // calculate expected balance after compound withdraw
      let expectedBalance = stakingBalance.add(expectedYield).add(rewardBalance);
      let currentStakingBalance = await farmXYZ.stakingBalance(john.address);

      expect(currentStakingBalance).to.eq(expectedBalance);
    });
  })
});
