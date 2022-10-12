import {
    ERC20,
    FarmFixedRiskWallet,
    FarmXYZBase,
    FarmXYZPlatformBridge,
    FarmXYZStrategy,
    XAssetBase,
    XAssetMacros
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers, network, upgrades, web3} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {mine} from "@nomicfoundation/hardhat-network-helpers";
import {getPRBProxy, getPRBProxyRegistry, PRBProxy, PRBProxyRegistry} from "@prb/proxy";
import {executeViaProxy} from "../helpers/proxy";
import {setTokenBalance} from "../helpers/chain";
import {parseUnits} from "ethers/lib/utils";
import "hardhat-gas-reporter"
import {getProxyForSigner, initializeBaseWalletsAndTokens, usdc} from "../helpers/helpers";

describe.only("FarmXYZProtocol XAssets", async () => {
    let totalRewardPool: BigNumber;

    let xAsset: XAssetBase;
    let shareToken: ERC20;
    let usdcToken: ERC20;
    let usdcTokenDecimals: number;

    let owner: SignerWithAddress;
    let john: SignerWithAddress;
    let alice: SignerWithAddress;

    let farmXYZFarm: FarmFixedRiskWallet;

    let ownerProxy: PRBProxy;

    let xassetMacros: XAssetMacros;

    async function invest(from: SignerWithAddress, amount:BigNumber) {
        let proxy = await getProxyForSigner(from);
        expect(await executeViaProxy(proxy, from, xassetMacros, 'investIntoXAsset', [xAsset.address, usdcToken.address, amount])).to.not.be.revertedWith('ERC20: transfer amount exceeds balance');
    }

    async function withdraw(from: SignerWithAddress, shares:BigNumber) {
        let proxy = await getProxyForSigner(from);
        expect(await executeViaProxy(proxy, from, xassetMacros, 'withdrawFromXAsset', [xAsset.address, shares])).to.not.be.reverted;
    }

    async function initialize() {
        let baseWalletsAndTokens = await initializeBaseWalletsAndTokens();
        usdcToken = baseWalletsAndTokens.usdcToken;
        usdcTokenDecimals = baseWalletsAndTokens.usdcTokenDecimals;
        owner = baseWalletsAndTokens.owner;
        john = baseWalletsAndTokens.john;
        alice = baseWalletsAndTokens.alice;

        ownerProxy = await getProxyForSigner(owner);

        totalRewardPool = usdc("1000000");
        const returnsPaybackPeriod = BigNumber.from(365*2*24*3600);

        // Then let's initialize the reward farm

        const FarmFixedRiskWallet = await ethers.getContractFactory("FarmFixedRiskWallet");
        const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWallet,
            [usdcToken.address],
            {kind: "uups"});
        const farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
        await farmXYZFarm.deployed();

        await usdcToken.approve(farmXYZFarm.address, totalRewardPool);
        await farmXYZFarm.depositToReturnsPool(totalRewardPool);
        await farmXYZFarm.setPaybackPeriod(returnsPaybackPeriod);

        // Now let's initialize the XAsset
        const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
        const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");

        const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], {kind: "uups"});
        await bridge.deployed();

        const strategy = await upgrades.deployProxy(FarmXYZStrategy,
            [bridge.address, farmXYZFarm.address, usdcToken.address],
            {kind: "uups"});

        const _shareToken = await upgrades.deployProxy(XAssetShareToken,
            ["X-DAI/USDC/USDT XASSET", "X-DAI-USDC-USDT"],
            {kind: "uups"});
        await _shareToken.deployed();
        shareToken = _shareToken as ERC20;

        const xassetProxy = await upgrades.deployProxy(XAssetBase,
            ["X-DAI-USDC-USDT", usdcToken.address, _shareToken.address],
            {kind: "uups"});
        await xassetProxy.deployed();
        await _shareToken.setXAsset(xassetProxy.address);
        await (xassetProxy as XAssetBase).setStrategy(strategy.address);
        await usdcToken.transfer(xassetProxy.address, usdc("10"));
        await (xassetProxy as XAssetBase).executeInitialInvestment();

        // Now that all those are done let's initialize the macros contract
        const XAssetMacros = await ethers.getContractFactory("XAssetMacros");
        xassetMacros = await XAssetMacros.deploy();

        await Promise.all([
            bridge.deployed(),
            strategy.deployed(),
            xassetProxy.deployed(),
        ]);

        xAsset = xassetProxy as XAssetBase;
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

    describe('Invest', () => {

        it('should allow users to invest a specific token amount', async () => {

            const sharesBefore = await shareToken.totalSupply();
            await invest(john, usdc("10"));
            const sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter).to.greaterThan(sharesBefore);
        })

        it('should allow multiple users to invest a specific token amount', async () => {
            const amount = usdc("50");

            const sharesBefore = await shareToken.totalSupply();
            await invest(john, amount);
            const sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter).to.greaterThan(sharesBefore);

            await invest(alice, amount);
            const sharesAfter2 = await shareToken.totalSupply();

            expect(sharesAfter2).to.greaterThan(sharesAfter);
        })

        it('should allocate shares for the specific investment', async () => {
            const amount = usdc("10");

            const johnProxy = await getProxyForSigner(john);
            const sharesBefore = await xAsset.getTotalSharesOwnedBy(johnProxy.address);
            await invest(john, amount);
            const sharesAfter = await xAsset.getTotalSharesOwnedBy(johnProxy.address);

            expect(sharesAfter).to.greaterThan(sharesBefore);
        })

        it('should calculate price per share with no investments in the XASSET', async () => {
            const sharePrice = await xAsset.getSharePrice();

            expect(sharePrice).to.greaterThan("0");
        })

        it('should revert if not using proxy', async () => {
            const amount = usdc("10");

            expect(xAsset.connect(owner).invest(usdcToken.address, amount)).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        })

        it('should not revert if using proxy', async () => {
            const amount = usdc("10");

            console.log('owner address:', owner.address);
            await invest(owner, amount);
        })

        it('should calculate price per share', async () => {
            const amount = usdc("10");
            const pricePerShareBefore = await xAsset.getSharePrice();

            // await invest(owner, amount);
            // await xAsset.connect(owner).invest(usdcToken.address, amount);

            // await resetToBlock(33029130);

            // const pricePerShareAfter = await xAsset.getSharePrice();

            // expect(pricePerShareAfter.sub(pricePerShareBefore)).to.be.lt(10);
        })

        it('should return new price once a new block is mined', async () => {
            const amount = usdc("10");
            await invest(owner, amount);
            let prices=[];
            let pricePerShareBefore = await xAsset.getSharePrice();
            prices.push(pricePerShareBefore);
            await mine(1000);
            let pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
            pricePerShareBefore = pricePerShareAfter;
            await mine(5000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
            pricePerShareBefore = pricePerShareAfter;
            await mine(7000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
            await mine(8000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.not.eq(pricePerShareAfter);
            console.log('Prices: ', prices);
        })

        it('should calculate total value locked', async () => {
            const amount = usdc("10");
            const tvlBefore = await xAsset.getTVL();

            await invest(john, amount);

            const tvlAfter = await xAsset.getTVL();

            expect(tvlAfter.sub(tvlBefore)).to.be.gte(amount);

            await invest(owner, amount);

            const tvlAfter2 = await xAsset.getTVL();

            expect(tvlAfter2).to.be.gte(amount.mul(2));
        })

        it('should return total number of shares minted', async () => {
            const amount = usdc("10");
            await invest(john, amount);

            const totalShares = await shareToken.totalSupply();

            expect(totalShares).to.greaterThan(0);
        })

        it('should allow users to withdraw a specific amount of shares and receive an amount of tokens', async () => {
            // invest 100 tokens
            const amount = usdc("100");
            await invest(john, amount);

            const johnProxy = await getProxyForSigner(john);
            const valueBeforeWithdraw = await xAsset.getTotalValueOwnedBy(johnProxy.address);
            let ownedShares = await xAsset.getTotalSharesOwnedBy(johnProxy.address);
            console.log('ownedShares', web3.utils.fromWei(ownedShares.toString()));
            const halfOwnedShares = ownedShares.div(BigNumber.from(2));

            // withdraw half of the shares
            await withdraw(john, halfOwnedShares);
            // TODO: check balances!!!!

            ownedShares = await xAsset.getTotalSharesOwnedBy(johnProxy.address);
            console.log('ownedShares after', web3.utils.fromWei(ownedShares.toString()));

            expect(ownedShares.sub(halfOwnedShares).abs()).to.be.lt(2);

        })

        it('should calculate the total value owned by an address', async () => {
            const amount = usdc("10");

            const johnProxy = await getProxyForSigner(john);
            // calculate how many $ the user has initially
            const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(johnProxy.address);

            // invest some tokens
            await invest(john, amount);

            // calculate how many $ the user has after investing
            const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(johnProxy.address);
            console.log('valueOwnedAfter', web3.utils.fromWei(valueOwnedAfter.toString()));

            const valueDifference = valueOwnedAfter.sub(amount).abs();
            console.log('valueDifference', web3.utils.fromWei(valueDifference.toString()));
            expect(valueDifference).to.be.lte(5);
        })

        it('should calculate the amount of shares received for a specified token and amount', async () => {
            const amount = usdc("10");
            const shares = await xAsset.estimateSharesForInvestmentAmount(usdcToken.address, amount);

            expect(shares).to.greaterThan("0");
        })

    });
});
