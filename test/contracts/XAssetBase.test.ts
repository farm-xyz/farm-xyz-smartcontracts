import { FarmXYZBase, FarmXYZBridge, FarmXYZStrategy, RFarmXToken, TFarmXToken, XAssetBase } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";

describe.only("XAssetBase", async () => {
  const _apy: number = 120;  // percentage > 0
  const totalRewardPool: BigNumber = ethers.utils.parseEther("1000000");
  const totalUserBalance: BigNumber = ethers.utils.parseEther("100000");

  let rewardToken: RFarmXToken;
  let stakeToken: TFarmXToken;
  let farmXYZ: FarmXYZBase;

  let farmXYZStrategy: FarmXYZStrategy;
  let farmXYZBridge: FarmXYZBridge;
  let xAsset: XAssetBase;

  let owner: SignerWithAddress;
  let john: SignerWithAddress;
  let alice: SignerWithAddress;

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

});
