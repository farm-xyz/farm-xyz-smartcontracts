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
  const BASE_TOKEN = "USDT";

  let rewardToken: RFarmXToken;
  let stakeToken: TFarmXToken;
  let farmXYZ: FarmXYZBase;

  let farmXYZStrategy: FarmXYZStrategy;
  let farmXYZBridge: FarmXYZBridge;
  let xAsset: XAssetBase;

  let owner: SignerWithAddress;
  let john: SignerWithAddress;
  let joe: SignerWithAddress;

  beforeEach(async () => {
    const farmContracts = await deployFarmXYZContract(_apy);
    const assetContracts = await deployXAssetFarmContracts(farmContracts.farmXYZ);

    rewardToken = farmContracts.rewardToken;
    stakeToken = farmContracts.stakeToken;
    farmXYZ = farmContracts.farmXYZ;
    farmXYZBridge = assetContracts.bridge;
    farmXYZStrategy = assetContracts.strategy;
    xAsset = assetContracts.asset;

    [owner, john, joe] = await ethers.getSigners();

    await Promise.all([
      rewardToken.mint(owner.address, totalRewardPool),
      stakeToken.mint(john.address, totalUserBalance),
      stakeToken.mint(joe.address, totalUserBalance),
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

    it.only('should allow users to invest a specific token amount', async () => {
      const amount = ethers.utils.parseEther("10");

      const sharesBefore = await xAsset.totalShares();
      await xAsset.connect(john).invest(BASE_TOKEN, amount);
      const sharesAfter = await xAsset.totalShares();

      expect(sharesAfter).to.greaterThan(sharesBefore);
    })

    it('should allocate shares for the specific investment', async () => {
      const amount = ethers.utils.parseEther("10");

      const sharesBefore = await xAsset.getTotalValueOwnedBy(john.address);
      await xAsset.connect(john).invest(BASE_TOKEN, amount);
      const sharesAfter = await xAsset.getTotalValueOwnedBy(john.address);

      expect(sharesAfter).to.greaterThan(sharesBefore);
    })

    it('should calculate price per share with no investments in the XASSET', async () => {
      // todo: test with no investments
    })

    it('should calculate price per share', async () => {
      const amount = ethers.utils.parseEther("10");
      const pricePerShareBefore = await xAsset.getSharePrice();

      await xAsset.connect(john).invest(BASE_TOKEN, amount);
      const pricePerShareAfter = await xAsset.getSharePrice();

      expect(pricePerShareAfter).to.eq(pricePerShareBefore);
    })

    it('should calculate total value locked', async () => {
      const tvl = await xAsset.getTVL();

      expect(tvl).to.greaterThan(ethers.utils.parseEther("0"));
    })

    it('should return total number of shares minted', async () => {
      const totalShares = await xAsset.totalShares();

      expect(totalShares).to.greaterThan(ethers.utils.parseEther("0"));
    })

    it('should allow users to withdraw a specific amount of shares and receive an amount of tokens', async () => {
      // invest 100 tokens
      await xAsset.connect(john).invest(BASE_TOKEN, ethers.utils.parseEther("100"));

      let ownedShares = await xAsset.getTotalValueOwnedBy(john.address);
      const halfOwnedShares = ownedShares.div(BigNumber.from(2));

      // withdraw half of the shares
      await xAsset.connect(john).withdraw(BASE_TOKEN, halfOwnedShares);

      ownedShares = await xAsset.getTotalValueOwnedBy(john.address);

      expect(halfOwnedShares).to.eq(ownedShares);
    })

    it('should calculate the total value owned by an address', async () => {
      // calculate how many shares the user has initially
      const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(john.address);

      // invest some tokens
      await xAsset.connect(john.address).invest(ethers.utils.parseEther("10"));

      // calculate how many shares the user has after investing
      const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(john.address);

      expect(valueOwnedAfter).to.greaterThan(valueOwnedBefore);
    })

    it('should calculate the amount of shares received for a specified token and amount', async () => {
      const valueOwnedBefore = await xAsset.getPrice();
    })
  });
});
