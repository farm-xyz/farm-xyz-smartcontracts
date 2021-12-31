import {FarmXYZBase, RFarmXToken, TFarmXToken} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {time} from '@openzeppelin/test-helpers';

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
* */

describe.only("Farm XYZ", async () => {
  const _apy: number = 10;  // percentage > 0
  const rewardAmount: BigNumber = ethers.utils.parseEther("1000000");
  const stakeAmount: BigNumber = ethers.utils.parseEther("500000");

  let rFarmXToken: RFarmXToken;
  let tFarmXToken: TFarmXToken;
  let farmXYZ: FarmXYZBase;
  let owner: SignerWithAddress;
  let john: SignerWithAddress;

  beforeEach(async () => {
    const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
    const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
    const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");

    rFarmXToken = await RFarmXToken.deploy();
    tFarmXToken = await TFarmXToken.deploy();
    await Promise.all([
      rFarmXToken.deployed(),
      tFarmXToken.deployed(),
    ]);

    farmXYZ = await FarmXYZBase.deploy(tFarmXToken.address, rFarmXToken.address, _apy);
    await farmXYZ.deployed();

    [owner, john] = await ethers.getSigners();

    await Promise.all([
      rFarmXToken.mint(owner.address, rewardAmount),
      tFarmXToken.mint(john.address, stakeAmount),
    ])
  })

  describe('init', () => {
    it("should initialize", async () => {
      expect(rFarmXToken).to.be.ok;
      expect(tFarmXToken).to.be.ok;
      expect(farmXYZ).to.be.ok;
    })

    it('should deposit rewards to reward pool', async () => {
      await rFarmXToken.connect(owner).approve(farmXYZ.address, rewardAmount);
      await farmXYZ.connect(owner).depositToRewardPool(rewardAmount);

      expect(await farmXYZ.totalRewardPool())
          .to.eq(rewardAmount)
    })
  })

  describe('Stake', async () => {
    it('should approve transfer and stake amount', async () => {
      await tFarmXToken.connect(john).approve(farmXYZ.address, stakeAmount);

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
    beforeEach(async () => {
      await tFarmXToken.connect(john).approve(farmXYZ.address, stakeAmount);
      await farmXYZ.connect(john).stake(stakeAmount)
    })

    it('should unstake balance from user', async () => {
      await farmXYZ.connect(john).unstake(stakeAmount);

      const stakingBalance = await farmXYZ.stakingBalance(john.address);
      expect(Number(stakingBalance))
          .to.eq(0);

      expect(await farmXYZ.isStaking(john.address))
          .to.eq(false);
    });
  })

  describe('Withdraw yield', async () => {
    beforeEach(async () => {
      const toTransfer = ethers.utils.parseEther("100");

      await rFarmXToken.transferOwnership(farmXYZ.address);
      await tFarmXToken.connect(john).approve(farmXYZ.address, toTransfer);
      await farmXYZ.connect(john).stake(toTransfer);
    })

    it('should return correct yield time', async () => {
      let timeStart = await farmXYZ.startTime(john.address)
      expect(Number(timeStart))
          .to.be.greaterThan(0)

      // Fast-forward time
      await time.increase(86400)

      expect(await farmXYZ.calculateYieldTime(john.address))
          .to.eq((86400))
    })

    it.only('should calculate correct yield', async () => {
      let toTransfer = await farmXYZ.calculateYieldTotal(john.address);
      let staked = await farmXYZ.stakingBalance(john.address)
      console.log({staked});
      console.log({toTransfer});

      await time.increase(86400)
      toTransfer = await farmXYZ.calculateYieldTotal(john.address)
      console.log({toTransfer});

      // TODO: calculate correct yield
    });

    it("should mint correct token amount in total supply and user", async () => {
      await time.increase(86400)
      // TODO: withdraw total yield from farm

      let _time = await farmXYZ.calculateYieldTime(john.address)
      let formatTime = _time.div(86400)
      let staked = await farmXYZ.stakingBalance(john.address)
      let bal = staked.mul(formatTime)
      let newBal = ethers.utils.formatEther(bal.toString())
      let expected = Number.parseFloat(newBal).toFixed(3)
      let rewards = await farmXYZ.rewardBalance(john.address)
      let res;

      let toTransfer = await farmXYZ.calculateYieldTotal(john.address);
      console.log('yield', {
        toTransfer,
        staked,
        bal,
        rewards,
        expected
      });
      await farmXYZ.connect(john).withdrawYield()

      // res = await tFarmXToken.totalSupply()
      // let newRes = ethers.utils.formatEther(res)
      // let formatRes = Number.parseFloat(newRes).toFixed(3).toString()
      //
      // expect(expected)
      //     .to.eq(formatRes)
      //
      // res = await tFarmXToken.balanceOf(john.address)
      // newRes = ethers.utils.formatEther(res)
      // formatRes = Number.parseFloat(newRes).toFixed(3).toString()
      //
      // expect(expected)
      //     .to.eq(formatRes)
    })

    it("should update yield balance when unstaked", async () => {
      await time.increase(86400)
      await farmXYZ.connect(john).unstake(ethers.utils.parseEther("5"))

      let res = await farmXYZ.stakingBalance(john.address)
      expect(Number(ethers.utils.formatEther(res)))
          .to.be.approximately(95, .001)
    })
  })
});
