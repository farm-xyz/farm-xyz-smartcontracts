import { FarmXYZBase, FarmXYZBridge, FarmXYZStrategy, RFarmXToken, TFarmXToken, XAssetBase } from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployFarmXYZContract, deployXAssetFarmContracts } from "../helpers/helpers";

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
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  beforeEach(async () => {
    const farmContracts = await deployFarmXYZContract(_apy);
    const assetContracts = await deployXAssetFarmContracts(farmContracts.farmXYZ);

    rewardToken = farmContracts.rewardToken;
    stakeToken = farmContracts.stakeToken;
    farmXYZ = farmContracts.farmXYZ;
    farmXYZBridge = assetContracts.bridge;
    farmXYZStrategy = assetContracts.strategy;
    xAsset = assetContracts.asset;

    [owner, user1, user2] = await ethers.getSigners();

    await Promise.all([
      rewardToken.mint(owner.address, totalRewardPool),
      stakeToken.mint(user1.address, totalUserBalance),
      stakeToken.mint(user2.address, totalUserBalance),
    ])
  })

  describe('Setup', () => {
    it("should initialize", async () => {
      expect(rewardToken).to.be.ok;
      expect(stakeToken).to.be.ok;
      expect(farmXYZ).to.be.ok;
      expect(farmXYZBridge).to.be.ok;
      expect(farmXYZStrategy).to.be.ok;
      expect(xAsset).to.be.ok;
    })
  });

  describe('Invest', () => {
    it('should invest', async () => {
      const amount = ethers.utils.parseEther("10");

      await xAsset.connect(user1).invest(amount, rewardToken.address);
    });
  });
});
