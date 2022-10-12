import {
    FarmXYZBase,
    FarmXYZPlatformBridge,
    FarmXYZStrategy,
    RFarmXToken,
    TFarmXToken,
    XAssetBase,
    TestToken,
    ERC20
} from "../../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {ethers, network, upgrades, web3} from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { deployFarmXYZTestContracts, deployXAssetFarmContracts } from "../helpers/helpers";
import {mine} from "@nomicfoundation/hardhat-network-helpers";

describe.only("SynapseProtocol XAsset", async () => {
    const _apy: number = 120;  // percentage > 0
    const totalRewardPool: BigNumber = ethers.utils.parseEther("1000000");
    const totalUserBalance: BigNumber = ethers.utils.parseEther("100000");

    let xAsset: XAssetBase;
    let shareToken: ERC20;
    let usdcToken: ERC20;

    let owner: SignerWithAddress;
    let john: SignerWithAddress;
    let joe: SignerWithAddress;


    async function initialize()
    {
        const ERC20Factory = await ethers.getContractFactory("ERC20");
        usdcToken = ERC20Factory.attach("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");

        const SynapsePlatformBridge = await ethers.getContractFactory("SynapsePlatformBridge");
        const SynapseProtocolStrategy = await ethers.getContractFactory("SynapseProtocolStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");

        const bridge = await upgrades.deployProxy(SynapsePlatformBridge, [], { kind: "uups" });
        await bridge.deployed();
        const strategy = await upgrades.deployProxy(SynapseProtocolStrategy, [bridge.address, usdcToken.address], { kind: "uups" });

        const _shareToken = await upgrades.deployProxy(XAssetShareToken, [ "X-nUSD/DAI/USDC/USDT Synapse Protocol XASSET", "X-nUSD-DAI-USDC-USDT" ], { kind: "uups" });
        await _shareToken.deployed();
        shareToken = _shareToken as ERC20;

        const xassetProxy = await upgrades.deployProxy(XAssetBase, [ "X-nUSD-DAI-USDC-USDT", usdcToken.address, _shareToken.address ], { kind: "uups" });
        await xassetProxy.deployed();
        await (xassetProxy as XAssetBase).setStrategy(strategy.address);
        await _shareToken.setXAsset(xassetProxy.address);

        await Promise.all([
            bridge.deployed(),
            strategy.deployed(),
            xassetProxy.deployed(),
        ]);

        xAsset = xassetProxy as XAssetBase;

        [owner, john, joe] = await ethers.getSigners();
    }

    beforeEach(async () => {
        // Let's set up the XASSET contracts
        await initialize();
    })

    describe('Setup', () => {
        it("should initialize", async () => {
            expect(shareToken).to.be.ok;
            expect(xAsset).to.be.ok;
        })
    });

    // describe('Invest', () => {
    //
    //     it('should allow users to invest a specific token amount', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //
    //         const sharesBefore = await shareToken.totalSupply();
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //         const sharesAfter = await shareToken.totalSupply();
    //
    //         expect(sharesAfter).to.greaterThan(sharesBefore);
    //     })
    //
    //     it('should allow multiple users to invest a specific token amount', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //
    //         const sharesBefore = await shareToken.totalSupply();
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //         const sharesAfter = await shareToken.totalSupply();
    //
    //         expect(sharesAfter).to.greaterThan(sharesBefore);
    //
    //         await xAsset.connect(joe).invest(usdcToken.address, amount);
    //         const sharesAfter2 = await shareToken.totalSupply();
    //
    //         expect(sharesAfter2).to.greaterThan(sharesAfter);
    //     })
    //
    //     it('should allocate shares for the specific investment', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //
    //         const sharesBefore = await xAsset.getTotalSharesOwnedBy(john.address);
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //         const sharesAfter = await xAsset.getTotalSharesOwnedBy(john.address);
    //
    //         expect(sharesAfter).to.greaterThan(sharesBefore);
    //     })
    //
    //     it('should calculate price per share with no investments in the XASSET', async () => {
    //         const sharePrice = await xAsset.getSharePrice();
    //
    //         expect(sharePrice).to.greaterThan(ethers.utils.parseEther("0"));
    //     })
    //
    //     it.only('should calculate price per share', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //         const pricePerShareBefore = await xAsset.getSharePrice();
    //
    //         // await xAsset.connect(owner).invest(usdcToken.address, amount);
    //
    //         await resetToBlock(33029130);
    //
    //         const pricePerShareAfter = await xAsset.getSharePrice();
    //
    //         expect(pricePerShareAfter.sub(pricePerShareBefore)).to.be.lt(10);
    //     })
    //
    //     it('should return new price once a new block is mined', async () => {
    //         let pricePerShareBefore = await xAsset.getSharePrice();
    //         await mine(1000);
    //         let pricePerShareAfter = await xAsset.getSharePrice();
    //         expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
    //         pricePerShareBefore = pricePerShareAfter;
    //         await mine(5000);
    //         pricePerShareAfter = await xAsset.getSharePrice();
    //         expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
    //         pricePerShareBefore = pricePerShareAfter;
    //         await mine(7000);
    //         pricePerShareAfter = await xAsset.getSharePrice();
    //         expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
    //         await mine(8000);
    //         pricePerShareAfter = await xAsset.getSharePrice();
    //         expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
    //     })
    //
    //     it('should calculate total value locked', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //         const tvlBefore = await xAsset.getTVL();
    //
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //
    //         const tvlAfter = await xAsset.getTVL();
    //
    //         expect(tvlBefore).to.eq(ethers.utils.parseEther("0"));
    //         expect(tvlAfter).to.eq(amount);
    //
    //         await xAsset.invest(usdcToken.address, amount);
    //
    //         const tvlAfter2 = await xAsset.getTVL();
    //
    //         expect(tvlAfter2).to.eq(amount.mul(2));
    //     })
    //
    //     it('should return total number of shares minted', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //
    //         const totalShares = await shareToken.totalSupply();
    //
    //         expect(totalShares).to.greaterThan(ethers.utils.parseEther("0"));
    //     })
    //
    //     it('should allow users to withdraw a specific amount of shares and receive an amount of tokens', async () => {
    //         // invest 100 tokens
    //         const amount = ethers.utils.parseEther("100");
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //
    //         const valueBeforeWithdraw = await xAsset.getTotalValueOwnedBy(john.address);
    //         let ownedShares = await xAsset.getTotalSharesOwnedBy(john.address);
    //         console.log('ownedShares', web3.utils.fromWei(ownedShares.toString()));
    //         const halfOwnedShares = ownedShares.div(BigNumber.from(2));
    //
    //         // withdraw half of the shares
    //         await xAsset.connect(john).withdraw(halfOwnedShares);
    //         // TODO: check balances!!!!
    //
    //         ownedShares = await xAsset.getTotalSharesOwnedBy(john.address);
    //         console.log('ownedShares after', web3.utils.fromWei(ownedShares.toString()));
    //
    //         expect(ownedShares.sub(halfOwnedShares).abs()).to.be.lt(2);
    //
    //     })
    //
    //     it('should calculate the total value owned by an address', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //         // calculate how many $ the user has initially
    //         const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(john.address);
    //
    //         // invest some tokens
    //         await xAsset.connect(john).invest(usdcToken.address, amount);
    //
    //         // calculate how many $ the user has after investing
    //         const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(john.address);
    //         console.log('valueOwnedAfter', web3.utils.fromWei(valueOwnedAfter.toString()));
    //
    //         const valueDifference = valueOwnedAfter.sub(amount).abs();
    //         console.log('valueDifference', web3.utils.fromWei(valueDifference.toString()));
    //         expect(valueDifference).to.be.lte(5);
    //     })
    //
    //     it('should calculate the amount of shares received for a specified token and amount', async () => {
    //         const amount = ethers.utils.parseEther("10");
    //         const shares = await xAsset.estimateSharesForInvestmentAmount(usdcToken.address, amount);
    //
    //         expect(shares).to.greaterThan(ethers.utils.parseEther("0"));
    //     })
    //
    // });
});
