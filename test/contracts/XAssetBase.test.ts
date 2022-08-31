import {
  FarmXYZBase,
  FarmXYZPlatformBridge,
  FarmStrategy,
  RFarmXToken,
  TFarmXToken,
  XAssetBase,
  TestToken,
  ERC20
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployFarmXYZTestContracts, deployXAssetFarmContracts } from "../helpers/helpers";

describe.only("XAssetBase", async () => {
  const _apy: number = 120;  // percentage > 0
  const totalRewardPool: BigNumber = ethers.utils.parseEther("1000000");
  const totalUserBalance: BigNumber = ethers.utils.parseEther("100000");

  let rewardToken: RFarmXToken;
  let stakeToken: TFarmXToken;
  let farmXYZFarm: FarmXYZBase;
  let usdToken: ERC20;
  let shareToken: ERC20;

  let farmXYZStrategy: FarmStrategy;
  let farmXYZBridge: FarmXYZPlatformBridge;
  let xAsset: XAssetBase;

  let owner: SignerWithAddress;
  let john: SignerWithAddress;
  let joe: SignerWithAddress;

  beforeEach(async () => {
    const farmContracts = await deployFarmXYZTestContracts(_apy);
    const assetContracts = await deployXAssetFarmContracts(farmContracts.farmXYZFarm, farmContracts.usdToken);

    usdToken = farmContracts.usdToken;
    rewardToken = farmContracts.rewardToken;
    stakeToken = farmContracts.stakeToken;
    farmXYZFarm = farmContracts.farmXYZFarm;
    farmXYZBridge = assetContracts.bridge;
    farmXYZStrategy = assetContracts.strategy;
    xAsset = assetContracts.asset;
    shareToken = assetContracts.shareToken;

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
      expect(farmXYZFarm).to.be.ok;
      expect(farmXYZBridge).to.be.ok;
      expect(farmXYZStrategy).to.be.ok;
      expect(xAsset).to.be.ok;
    })
  });

  describe('Invest', () => {

    it('should allow users to invest a specific token amount', async () => {
      const amount = ethers.utils.parseEther("10");

      const sharesBefore = await shareToken.totalSupply();
      await xAsset.connect(john).invest(usdToken.address, amount);
      const sharesAfter = await shareToken.totalSupply();

      expect(sharesAfter).to.greaterThan(sharesBefore);
    })

    it('should allow multiple users to invest a specific token amount', async () => {
      const amount = ethers.utils.parseEther("10");

      const sharesBefore = await shareToken.totalSupply();
      await xAsset.connect(john).invest(usdToken.address, amount);
      const sharesAfter = await shareToken.totalSupply();

      expect(sharesAfter).to.greaterThan(sharesBefore);

      await xAsset.connect(joe).invest(usdToken.address, amount);
      const sharesAfter2 = await shareToken.totalSupply();

      expect(sharesAfter2).to.greaterThan(sharesAfter);
    })

    it('should allocate shares for the specific investment', async () => {
      const amount = ethers.utils.parseEther("10");

      const sharesBefore = await xAsset.getTotalSharesOwnedBy(john.address);
      await xAsset.connect(john).invest(usdToken.address, amount);
      const sharesAfter = await xAsset.getTotalSharesOwnedBy(john.address);

      expect(sharesAfter).to.greaterThan(sharesBefore);
    })

    it('should calculate price per share with no investments in the XASSET', async () => {
      const sharePrice = await xAsset.getSharePrice();

      expect(sharePrice).to.greaterThan(ethers.utils.parseEther("0"));
    })

    it('should calculate price per share', async () => {
      const amount = ethers.utils.parseEther("10");
      const pricePerShareBefore = await xAsset.getSharePrice();

      await xAsset.connect(john).invest(usdToken.address, amount);
      const pricePerShareAfter = await xAsset.getSharePrice();

      expect(pricePerShareAfter).to.eq(pricePerShareBefore);
    })

    it('should calculate total value locked', async () => {
      const amount = ethers.utils.parseEther("10");
      const tvlBefore = await xAsset.getTVL();

      await xAsset.connect(john).invest(usdToken.address, amount);

      const tvlAfter = await xAsset.getTVL();

      expect(tvlBefore).to.eq(ethers.utils.parseEther("0"));
      expect(tvlAfter).to.eq(amount);

      await xAsset.invest(usdToken.address, amount);

      const tvlAfter2 = await xAsset.getTVL();

      expect(tvlAfter2).to.eq(amount.mul(2));
    })

    it('should return total number of shares minted', async () => {
      const amount = ethers.utils.parseEther("10");
      await xAsset.connect(john).invest(usdToken.address, amount);

      const totalShares = await shareToken.totalSupply();

      expect(totalShares).to.greaterThan(ethers.utils.parseEther("0"));
    })

    it('should allow users to withdraw a specific amount of shares and receive an amount of tokens', async () => {
      // invest 100 tokens
      const amount = ethers.utils.parseEther("100");
      await xAsset.connect(john).invest(usdToken.address, amount);

      let ownedShares = await xAsset.getTotalSharesOwnedBy(john.address);
      const halfOwnedShares = ownedShares.div(BigNumber.from(2));

      // withdraw half of the shares
      await xAsset.connect(john).withdraw(halfOwnedShares);

      ownedShares = await xAsset.getTotalSharesOwnedBy(john.address);

      expect(halfOwnedShares).to.eq(ownedShares);

      const valueAfterWithdraw = await xAsset.getTotalValueOwnedBy(john.address);

      expect(valueAfterWithdraw).to.eq(amount.div(2));
    })

    it('should calculate the total value owned by an address', async () => {
      const amount = ethers.utils.parseEther("10");
      // calculate how many shares the user has initially
      const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(john.address);

      // invest some tokens
      await xAsset.connect(john).invest(usdToken.address, amount);

      // calculate how many shares the user has after investing
      const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(john.address);

      expect(valueOwnedAfter).to.eq(amount);
    })

    it('should calculate the amount of shares received for a specified token and amount', async () => {
      const amount = ethers.utils.parseEther("10");
      const shares = await xAsset.estimateSharesForInvestmentAmount(usdToken.address, amount);

      expect(shares).to.greaterThan(ethers.utils.parseEther("0"));
    })

    // it('should update')

  });
});
