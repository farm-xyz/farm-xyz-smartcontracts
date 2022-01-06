import {FarmXYZBase, RFarmXToken, TFarmXToken} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {snapshot, time} from '@openzeppelin/test-helpers';
import {fail} from "assert";

/* TODO: tests

tf = deploy TFarmXToken
rf = deploy RFarmxToken
deploy FarmXBase(address(tf), address(rf))

1. Mint rewards - 1 mil RFarmX
2. deposit rewards to reward pool
3. Mint tokens - 500k TFarmX
4. stake TFarmX
5. withdraw Yield
6. unstake Tokens - check that yield is also calculated
7. Check total value locked

---
8. Check what happens when there aren't enough reward tokens in the pool

    // todo: withdraw amount with rewards
    // todo: withdraw amount without rewards
    // todo: withdraw amount with "compound" option

* */

describe.only("Farm XYZ", async () => {
  const _apy: number = 10;  // percentage > 0
  const totalRewardPool: BigNumber = ethers.utils.parseEther("1000000");
  const totalStakePool: BigNumber = ethers.utils.parseEther("500000");

  let rewardToken: RFarmXToken;
  let stakeToken: TFarmXToken;
  let farmXYZ: FarmXYZBase;
  let owner: SignerWithAddress;
  let john: SignerWithAddress;

  function calculateCorrectYield(time: number, staked: BigNumber) {
    const stakeTime = BigNumber.from(time);
    const ratePerSecond = BigNumber.from(_apy).mul(BigNumber.from("10").pow(18)).div(BigNumber.from(100)).div(BigNumber.from(365 * 24 * 3600));

    return ratePerSecond.mul(staked).mul(stakeTime).div(BigNumber.from("10").pow(18));
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

    [owner, john] = await ethers.getSigners();

    await Promise.all([
      rewardToken.mint(owner.address, totalRewardPool),
      stakeToken.mint(john.address, totalStakePool),
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
    it('should return rewards per day average', function () {

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
      await rewardToken.transferOwnership(farmXYZ.address);
      await stakeToken.connect(john).approve(farmXYZ.address, totalStakePool);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);

      expect(await farmXYZ.connect(john).stake(totalStakePool))
          .to.be.ok;

      expect(await farmXYZ.stakingBalance(john.address))
          .to.eq(totalStakePool);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(true);
    });
  })

  describe('Unstake', async () => {
    beforeEach(async () => {
      await stakeToken.connect(john).approve(farmXYZ.address, totalStakePool);
      await farmXYZ.connect(john).stake(totalStakePool)
    })

    it('should unstake balance from user', async () => {
      await farmXYZ.connect(john).unstake(totalStakePool);

      const stakingBalance = await farmXYZ.stakingBalance(john.address);
      expect(Number(stakingBalance))
          .to.eq(0);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);
    })

    it("should update yield balance when unstaked", async () => {
      await time.increase(86400)
      await farmXYZ.connect(john).unstake(ethers.utils.parseEther("5"))

      let res = await farmXYZ.stakingBalance(john.address)
      expect(Number(ethers.utils.formatEther(res)))
          .to.be.approximately(95, .001)
    })
  })

  describe('Yield', async () => {
    it('should return correct yield time', async () => {
      let timeStart = await farmXYZ.startTime(john.address)
      expect(Number(timeStart))
          .to.be.greaterThanOrEqual(0)

      // Fast-forward time
      await time.increase(86400)

      expect(await farmXYZ.calculateYieldTime(john.address))
          .to.eq((86400))
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

    it('should not withdraw when there are less rewards available in farm than withdraw yield', async () => {
      let staked = await farmXYZ.stakingBalance(john.address)
      let rewards = await farmXYZ.rewardBalance(john.address)

      expect(staked).to.eq(totalStakePool);
      expect(rewards).to.eq(0);

      const stakeTime = 365 * 24 * 3600;
      await time.increase(stakeTime);

      try {
        await farmXYZ.connect(john).withdrawYield(false);
        fail('Expected error: `Insuficient balance`');
      } catch (e: any) {
        expect(e.message).to.eq("VM Exception while processing transaction: reverted with reason string 'Insuficient balance'");
      }
    });
  })

  describe('Harvest withdrawal', async () => {
    beforeEach(async () => {
      // deposit rewards
      await rewardToken.connect(owner).approve(farmXYZ.address, totalRewardPool);
      await farmXYZ.connect(owner).depositToRewardPool(totalRewardPool);
    })

    it.only('should be able to harvest yield after staking', async () => {
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

      const blockSnapshot = await snapshot();
      await time.advanceBlock();
      const expectedYield = calculateCorrectYield(timeStaked + 1, initialStaked);
      const availableYield = await farmXYZ.calculateYieldTotal(john.address);
      await blockSnapshot.restore();

      expect(expectedYield).to.eq(availableYield);

      console.log('before-withdraw', {initialStaked, initialRewards, initialBalance, initialRewardPool, availableYield});

      // withdraw with harvest flag set
      await farmXYZ.connect(john).withdrawYield(false);

      let currentStaked = await farmXYZ.stakingBalance(john.address);
      let currentRewards = await farmXYZ.rewardBalance(john.address);
      let currentBalance = await john.getBalance();
      let currentRewardPool = await farmXYZ.totalRewardPool();

      console.log('after-withdraw', {currentStaked, currentRewards, currentBalance, currentRewardPool});

      expect(currentStaked).to.eq(initialStaked);
      expect(currentRewards).to.eq(0);
      expect(currentBalance).to.eq(initialBalance.add(expectedYield));
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

      // some time is passing
      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked);

      // save initial balance
      let staked = await farmXYZ.stakingBalance(john.address);
      let rewardBalance = await farmXYZ.rewardBalance(john.address);

      // withdraw with compound flag set
      await farmXYZ.connect(john).withdrawYield(true);

      // calculate expected balance after compound withdraw
      let expectedYield = calculateCorrectYield(timeStaked, staked);
      let expectedBalance = staked.add(expectedYield).add(rewardBalance);

      // todo: for some reason expected stake balance is different from calculated stake balance in farm
      console.log({staked, expectedYield, rewardBalance, expectedBalance});
      console.log('stakingBalance', await farmXYZ.stakingBalance(john.address));

      expect(await farmXYZ.stakingBalance(john.address)).to.eq(expectedBalance);
    });
  })
});
