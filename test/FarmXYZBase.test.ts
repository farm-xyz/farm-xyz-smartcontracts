import {FarmXYZBase, RFarmXToken, TFarmXToken} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";

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

    it.only('should deposit rewards to reward pool', async () => {
      const transaction = await farmXYZ.connect(owner).depositToRewardPool(rewardAmount);
      expect(transaction).to.be.ok;
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
});
