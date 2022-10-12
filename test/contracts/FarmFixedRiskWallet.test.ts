import {ERC20, FarmFixedRiskWallet, RFarmXToken, TFarmXToken} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {snapshot, time} from '@openzeppelin/test-helpers';
import {fail} from "assert";
import {setTokenBalance} from "../helpers/chain";
import {parseUnits} from "ethers/lib/utils";
import {getPRBProxy, getPRBProxyRegistry, PRBProxy, PRBProxyRegistry} from "@prb/proxy";
import {getProxyForSigner, initializeBaseWalletsAndTokens} from "../helpers/helpers";
import { expect } from "chai";
import {ethers, upgrades} from "hardhat";

describe("Farm XYZ", async () => {
  const _apy: number = 120;  // percentage > 0
  const rateDenominator: BigNumber = BigNumber.from(10).pow(18);
  let totalReturnsPool: BigNumber;
  let returnsDeposited: BigNumber;
  let returnsPaybackPeriod: BigNumber;
  let totalStaked: BigNumber;

  let usdcToken: ERC20;
  let usdcTokenDecimals: number;

  let farmXYZ: FarmFixedRiskWallet;
  let owner: SignerWithAddress;
  let ownerProxy: PRBProxy;
  let john: SignerWithAddress;
  let alice: SignerWithAddress;

  async function calculateRatePerSecond() {
    return rateDenominator.mul(returnsDeposited).div(returnsPaybackPeriod).div(totalStaked);
  }

  async function calculateCorrectYield(time: BigNumber, staked: BigNumber) {
    const ratePerSecond = await calculateRatePerSecond();
    console.log("[cCY] returnsDeposited: " + returnsDeposited.toString());
    console.log("[cCY] totalStaked: " + totalStaked.toString());
    console.log("[cCY] ratePerSecond: " + ratePerSecond.toString());
    console.log("[cCY] time: " + time.toString());

    return ratePerSecond.mul(staked).mul(time).div(rateDenominator);
  }

  async function calculateNextBlockYield(staked: BigNumber) {
    const blockSnapshot = await snapshot();
    await time.advanceBlock();
    const nextBlockTime = await farmXYZ.calculateYieldTime(john.address);
    const expectedYield = await calculateCorrectYield(nextBlockTime, staked);
    const availableYield = await farmXYZ.calculateYieldTotal(john.address);
    await blockSnapshot.restore();

    return {expectedYield, availableYield};
  }

  async function stakeInFarm(user: SignerWithAddress, amount: BigNumber) {
    expect(await usdcToken.connect(user).approve(farmXYZ.address, amount)).to.be.ok;
    console.log("Staking ", amount.toString(), " USDC balance: ", (await usdcToken.balanceOf(user.address)).toString());
    expect(await farmXYZ.connect(user).stake(amount)).to.be.ok;
    totalStaked = totalStaked.add(amount);
  }

  async function stakeUSDCInFarm(user: SignerWithAddress, amount: string) {
    return stakeInFarm(user, parseUnits(amount, usdcTokenDecimals));
  }

  async function unstakeFromFarm(user: SignerWithAddress, amount: BigNumber) {
    expect(await farmXYZ.connect(user).unstake(amount)).to.be.ok;
  }

  async function depositToReturnsPool(amount: BigNumber) {
    expect(await usdcToken.connect(owner).approve(farmXYZ.address, amount)).to.be.ok;
    expect(await farmXYZ.connect(owner).depositToReturnsPool(amount)).to.be.ok;
    returnsDeposited=returnsDeposited.add(amount);
  }

  function usdc(amount:string) {
    return parseUnits(amount, usdcTokenDecimals);
  }

  beforeEach(async () => {
    let baseWalletsAndTokens = await initializeBaseWalletsAndTokens();
    usdcToken = baseWalletsAndTokens.usdcToken;
    usdcTokenDecimals = baseWalletsAndTokens.usdcTokenDecimals;
    owner = baseWalletsAndTokens.owner;
    ownerProxy = await getProxyForSigner(owner);
    john = baseWalletsAndTokens.john;
    alice = baseWalletsAndTokens.alice;

    totalReturnsPool = parseUnits("10000", usdcTokenDecimals);
    totalStaked = BigNumber.from(0);
    returnsPaybackPeriod = BigNumber.from(365*2*24*3600);
    returnsDeposited = BigNumber.from(0);

    const FarmFixedRiskWallet = await ethers.getContractFactory("FarmFixedRiskWallet");
    const farmXYZProxy = await upgrades.deployProxy(FarmFixedRiskWallet,
        [usdcToken.address],
        {kind: "uups"});
    const farmXYZ = farmXYZProxy as FarmFixedRiskWallet;
    await farmXYZ.deployed();
    await farmXYZ.setPaybackPeriod(returnsPaybackPeriod);
  })

  describe('Setup', () => {
    it("should initialize", async () => {
      expect(farmXYZ).to.be.ok;
    })
  })

  describe('Rewards', async () => {
    it('should calculate total value deposited', async () => {
      const stakeAmount = usdc("100");

      expect(await farmXYZ.totalValueDeposited()).to.eq(0);

      // a user stake's an amount
      await stakeInFarm(john, stakeAmount);

      expect(await farmXYZ.totalValueDeposited()).to.eq(stakeAmount);

      // another use stake's an amount
      await stakeInFarm(alice, stakeAmount);

      expect(await farmXYZ.totalValueDeposited()).to.eq(stakeAmount.add(stakeAmount));
    });

    it('should deposit returns to return pool', async () => {
      await depositToReturnsPool(totalReturnsPool);

      expect(await farmXYZ.totalReturnsDeposited())
          .to.eq(totalReturnsPool)
    })
  })

  describe('Whitelist', async () => {
    it('should only allow whitelisted users when whitelist feature is enabled', async () => {
        let stakeAmount = usdc("100");

        // enable whitelist
        await farmXYZ.setWhitelistEnabled(true);

        expect(await farmXYZ.getUserBalance(john.address))
          .to.eq(0);

        expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);

        await stakeInFarm(john, stakeAmount);

        expect(await farmXYZ.getUserBalance(john.address))
            .to.eq(stakeAmount);

        expect(await farmXYZ.isStaking(john.address))
            .to.eq(true);
    });
  })

  describe('Stake', async () => {
    it('should approve transfer and stake amount', async () => {
      let stakeAmount = usdc("100");

      expect(await farmXYZ.getUserBalance(john.address))
          .to.eq(0);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);

      await stakeInFarm(john, stakeAmount);

      expect(await farmXYZ.getUserBalance(john.address))
          .to.eq(stakeAmount);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(true);
    });
  })

  describe('Unstake', async () => {
    let stakeAmount:BigNumber = BigNumber.from(0);

    beforeEach(async () => {
      stakeAmount = usdc("100");
      await stakeInFarm(john, stakeAmount);
    })

    it('should unstake balance from user', async () => {
      expect(await farmXYZ.isStaking(john.address))
          .to.eq(true);

      await unstakeFromFarm(john, stakeAmount);

      expect(await farmXYZ.getUserBalance(john.address))
          .to.eq(0);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);
    })

    it("should update yield balance when unstaked", async () => {
      const unstakeAmount = usdc("5");
      await time.increase(86400);

      await unstakeFromFarm(john, unstakeAmount);

      expect(await farmXYZ.getUserBalance(john.address))
          .to.be.eq(stakeAmount.sub(unstakeAmount));
    })
  })

  describe('Yield', async () => {
    it('should return correct yield time', async () => {
      // when there is no action made by the user the start time is not set
      expect((await farmXYZ.startTime(john.address)).toNumber())
          .to.be.eq(0);

      // when staking start time should be updated
      await stakeUSDCInFarm(john, "100");

      expect((await farmXYZ.startTime(john.address)).toNumber())
          .to.be.eq((await time.latest()).toNumber());

      // Fast-forward time
      const timeStaked = 24 * 3600;
      await time.increase(timeStaked);

      const yieldTime = await farmXYZ.calculateYieldTime(john.address);
      const diff = yieldTime.sub(timeStaked);
      expect(diff.toNumber()).to.be.lte(2);

    })

    it('should calculate correct yield', async () => {

      await depositToReturnsPool(totalReturnsPool);

      await stakeUSDCInFarm(john, "100");

      let availableYield: BigNumber;
      let staked = await farmXYZ.stakingBalance(john.address)

      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked)
      availableYield = await farmXYZ.calculateYieldTotal(john.address);
      const realTimeStaked = await farmXYZ.calculateYieldTime(john.address);
      let expectedYield = await calculateCorrectYield(realTimeStaked, staked);

      expect(availableYield).to.eq(expectedYield);
    });
  })


  describe('Harvest withdrawal', async () => {
    beforeEach(async () => {
      // deposit rewards
      await depositToReturnsPool(totalReturnsPool);
    })

    it('should be able to harvest yield after staking', async () => {

      let initialBalance = await usdcToken.balanceOf(john.address);

      // stake an amount into the pool
      expect(await farmXYZ.stakingBalance(john.address)).to.eq(0);
      let stakeAmount = usdc("100");
      await stakeInFarm(john, stakeAmount);

      console.log("Returns amount: ", returnsDeposited.toString());
      console.log("Staked amount: ", stakeAmount.toString());

      // save initial parameters
      let initialStaked = await farmXYZ.stakingBalance(john.address);
      let initialRewards = BigNumber.from(0);
      let initialRewardPool = await farmXYZ.totalReturnsDeposited();

      expect(initialStaked).to.eq(stakeAmount);

      // some time is passing
      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked);

      const {expectedYield, availableYield} = await calculateNextBlockYield(initialStaked);

      expect(expectedYield).to.eq(availableYield);

      console.log('before-withdraw', {initialStaked, initialRewards, initialBalance, initialRewardPool, expectedYield, availableYield});

      // withdraw with harvest flag set
      await farmXYZ.connect(john).unstakeAll();

      let currentStaked = await farmXYZ.stakingBalance(john.address);
      let currentBalance = await usdcToken.balanceOf(john.address);
      let currentRewardPool = await farmXYZ.totalReturnsDeposited();
      const expectedBalance = initialBalance.add(expectedYield);

      console.log('after-withdraw', {currentStaked, initialBalance, expectedBalance, currentBalance, currentRewardPool});

      expect(currentStaked).to.eq(0);
      expect(currentBalance).to.eq(expectedBalance);
      expect(currentRewardPool).to.eq(initialRewardPool.sub(expectedYield));
    })
  })

  describe('Compound withdrawal', async () => {
    beforeEach(async () => {
      // deposit rewards
      await depositToReturnsPool(totalReturnsPool);
    })

    it('should be able to withdraw compound yield after staking', async () => {
      // stake an amount into the pool
      await stakeUSDCInFarm(john, "100");

      // save initial balance
      let stakingBalance = await farmXYZ.getUserBalance(john.address);

      // some time is passing
      const timeStaked = 365 * 24 * 3600;
      await time.increase(timeStaked);

      const {expectedYield, availableYield} = await calculateNextBlockYield(stakingBalance);

      expect(availableYield).to.eq(expectedYield);

      // withdraw with compound flag set
      await farmXYZ.connect(john).compoundYield();

      // calculate expected balance after compound withdraw
      let expectedBalance = stakingBalance.add(expectedYield);
      let currentStakingBalance = await farmXYZ.getUserBalance(john.address);

      expect(currentStakingBalance).to.eq(expectedBalance);
    });
  })
});
