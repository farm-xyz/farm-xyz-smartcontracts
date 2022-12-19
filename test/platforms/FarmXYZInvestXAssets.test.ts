import {
    ERC20,
    FarmConfigSet,
    FarmFixedRiskWallet, FarmInvestableWallet,
    FarmXYZPlatformBridge,
    FarmXYZStrategy,
    XAssetBase,
    XAssetMacros,
    XAssetShareToken
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers, upgrades, web3} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {mine, time} from "@nomicfoundation/hardhat-network-helpers";
import {getPRBProxyRegistry, PRBProxy, PRBProxyRegistry} from "@prb/proxy";
import {executeViaProxy} from "../helpers/proxy";
import "hardhat-gas-reporter"
import {
    baseWalletsAndTokens,
    getProxyForSigner,
    initializeBaseWalletsAndTokens,
    setBaseWalletsAndTokens,
    usdc, usdt
} from "../helpers/helpers";
import fs, {readFileSync} from "fs";
import {parseUnits} from "ethers/lib/utils";
// import {timeout} from "../helpers/utils";
import hre = require("hardhat");


describe.only("FarmXYZ Investments XAssets", async () => {

    const forceRedeploy = true;

    let proxyRegistryAddress: string = "0x43fA1CFCacAe71492A36198EDAE602Fe80DdcA63";

    let totalRewardPool: BigNumber;

    let xAsset: XAssetBase;
    let shareToken: ERC20;
    let usdcToken: ERC20;
    let usdcTokenDecimals: number;
    let usdtToken: ERC20;
    let usdtTokenDecimals: number;

    let owner: SignerWithAddress;
    let john: SignerWithAddress;
    let alice: SignerWithAddress;

    let ownerProxy: PRBProxy;

    let xassetMacros: XAssetMacros;

    async function macroTest(from: SignerWithAddress, amount:BigNumber) {
        let proxy = await getProxyForSigner(from);
        console.log('Invest via proxy: ', proxy.address);
        const transaction = await executeViaProxy(proxy, from, xassetMacros, 'macroTest', [xAsset.address, usdcToken.address, amount]);
        expect(transaction).to.not.be.revertedWith('ERC20: transfer amount exceeds balance');
        console.log("Sent tx hash: ", transaction.hash);
    }

    async function invest(from: SignerWithAddress, amount:BigNumber, token:string|null = null) {
        if (!token) token = usdcToken.address;
        // log the balance of the user
        let balance = await usdcToken.balanceOf(from.address);
        console.log("Invest ", amount, " Balance of ", from.address, " is ", balance.toString());
        if (amount.gt(balance)) {
            throw new Error("Invest: Not enough balance");
        }
        let proxy = await getProxyForSigner(from);

        console.log('Invest via proxy: ', proxy.address);
        await expect(executeViaProxy(proxy, from, xassetMacros, 'investIntoXAsset', [xAsset.address, token, amount])).to.not.be.reverted;
    }

    async function withdraw(from: SignerWithAddress, shares:BigNumber) {
        let ownedSharesBefore = await xAsset.getTotalSharesOwnedBy(from.address);
        let proxy = await getProxyForSigner(from);
        let tx = await expect(executeViaProxy(proxy, from, xassetMacros, 'withdrawFromXAsset', [xAsset.address, shares])).to.be.revertedWith("Unstake not allowed, all investments are final");
        let ownedSharesAfter = await xAsset.getTotalSharesOwnedBy(from.address);
        expect(ownedSharesBefore).to.be.eq(ownedSharesAfter);

        return tx;
    }

    let config: { [key: string]: any } = {};

    function readConfig() {
        try {
            let configJson = readFileSync('config-farmx-invest.json', 'utf-8');
            config = JSON.parse(configJson);
        } catch (e) {
            config = {};
        }
    }

    function saveConfig() {
        if (hre.network.name=== 'hardhat') return;
        let configJson = JSON.stringify(config);
        fs.writeFileSync('config-farmx-invest.json', configJson);
    }

    async function initialize() {
        readConfig();
        let baseWalletsAndTokens = await initializeBaseWalletsAndTokens();
        usdcToken = baseWalletsAndTokens.usdcToken;
        usdcTokenDecimals = baseWalletsAndTokens.usdcTokenDecimals;
        usdtToken = baseWalletsAndTokens.usdtToken;
        usdtTokenDecimals = baseWalletsAndTokens.usdtTokenDecimals;
        owner = baseWalletsAndTokens.owner;
        john = baseWalletsAndTokens.john;
        alice = baseWalletsAndTokens.alice;

        ownerProxy = await getProxyForSigner(owner);

        const FarmInvestableWalletFactory = await ethers.getContractFactory("FarmInvestableWallet");
        const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
        const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        // const XAssetBaseV2 = await ethers.getContractFactory("XAssetBaseV2");
        const XAssetShareTokenFactory = await ethers.getContractFactory("XAssetShareToken");
        const XAssetMacros = await ethers.getContractFactory("XAssetMacros");


        // Then let's initialize the reward farm

        let farmXYZFarm;
        if (!forceRedeploy && config['FarmInvestableWallet']) {
            farmXYZFarm = FarmInvestableWalletFactory.attach(config['FarmInvestableWallet']) as FarmInvestableWallet;
        } else {
            const farmXYZFarmProxy = await upgrades.deployProxy(FarmInvestableWalletFactory,
                [ ],
                {kind: "uups"});
            farmXYZFarm = farmXYZFarmProxy as FarmInvestableWallet;
            await farmXYZFarm.deployed();
            config['FarmFixedRiskWallet'] = farmXYZFarm.address;
            saveConfig();
            console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
        }

        if (forceRedeploy || !config['FarmInvestableWalletInitialised']) {
            await farmXYZFarm.setWhitelistEnabled(true);
            await farmXYZFarm.addToWhitelist([owner.address, john.address, alice.address]);
            await farmXYZFarm.addToTokenWhitelist([usdcToken.address, usdtToken.address]);
            config['FarmFixedRiskWalletInitialised'] = true;
            saveConfig();
        }

        console.log("FarmInvestableWallet configured");

        let bridge;
        if (forceRedeploy || !config['FarmXYZPlatformBridge']) {
            bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], {kind: "uups"});
            await bridge.deployed();
            config['FarmXYZPlatformBridge'] = bridge.address;
            saveConfig();
            console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
        } else {
            bridge = FarmXYZPlatformBridge.attach(config['FarmXYZPlatformBridge']) as FarmXYZPlatformBridge;
        }

        let strategy;

        if (forceRedeploy || !config['FarmXYZStrategy']) {
            strategy = await upgrades.deployProxy(FarmXYZStrategy,
                [bridge.address, farmXYZFarm.address, usdcToken.address],
                {kind: "uups"});
            await strategy.deployed();
            config['FarmXYZStrategy'] = strategy.address;
            await farmXYZFarm.addToWhitelist([ strategy.address ]);
            saveConfig();
            console.log("FarmXYZStrategy deployed to:", strategy.address);
        } else {
            strategy = FarmXYZStrategy.attach(config['FarmXYZStrategy']) as FarmXYZStrategy;
        }

        let _shareToken;
        if (forceRedeploy || !config['XAssetShareToken']) {
            _shareToken = await upgrades.deployProxy(XAssetShareTokenFactory,
                ["FARMX Seed Allocation XASSET", "FARMX-Seed", proxyRegistryAddress],
                {kind: "uups"});
            await _shareToken.deployed();
            config['XAssetShareToken'] = _shareToken.address;
            saveConfig();
            console.log("XAssetShareToken deployed to:", _shareToken.address);
        } else {
            _shareToken = XAssetShareTokenFactory.attach(config['XAssetShareToken']) as XAssetShareToken;
        }


        shareToken = _shareToken as ERC20;

        let xassetProxy;
        if (forceRedeploy || !config['XAssetBase']) {
            xassetProxy = await upgrades.deployProxy(XAssetBase,
                ["X-FARMX-SEED", usdcToken.address, _shareToken.address, proxyRegistryAddress],
                {kind: "uups"});
            await xassetProxy.deployed();
            config['XAssetBase'] = xassetProxy.address;
            saveConfig();
            console.log("XAssetBase deployed to:", xassetProxy.address);
        } else {
            xassetProxy = XAssetBase.attach(config['XAssetBase']) as XAssetBase;

            if (config['upgrade'] && config['upgrade']['XAssetBase']) {
                throw new Error("XAssetBase upgrade not implemented");
                // console.log("Upgrading XAssetBase contract at", xassetProxy.address);
                // const oldContract = await upgrades.forceImport(config['XAssetBase'], XAssetBase, { kind: "uups" });
                // xassetProxy = await upgrades.upgradeProxy(xassetProxy.address, XAssetBaseV2, {kind: "uups"});
            }

        }

        if (forceRedeploy || !config['XAssetBaseInitialised']) {
            await _shareToken.setXAsset(xassetProxy.address);
            await (xassetProxy as XAssetBase).setStrategy(strategy.address);
            await (xassetProxy as XAssetBase).setAcceptedPriceDifference(100);
            await usdcToken.transfer(xassetProxy.address, usdc("1"));
            await (xassetProxy as XAssetBase)["executeInitialInvestment(uint256,uint256)"](usdc("0.121"), usdc("1"));
            config['XAssetBaseInitialised'] = true;
            saveConfig();
        }

        console.log("XAssetBase configured");

        // Now that all those are done let's initialize the macros contract
        if (!forceRedeploy && config['XAssetMacros']) {
            xassetMacros = XAssetMacros.attach(config['XAssetMacros']) as XAssetMacros;
        } else {
            xassetMacros = await XAssetMacros.deploy();
            config['XAssetMacros'] = xassetMacros.address;
            saveConfig();
            console.log("XAssetMacros deployed to:", xassetMacros.address);
        }

        if ((await usdcToken.allowance(owner.address, ownerProxy.address)).lte(parseUnits("100000", usdcTokenDecimals))) {
            console.log("Approving ownerProxy to spend USDC");
            await usdcToken.approve(ownerProxy.address, parseUnits("100000", usdcTokenDecimals));
        }
        if ((await usdcToken.balanceOf(john.address)).lte(parseUnits("5", usdcTokenDecimals))) {
            console.log("Transferring USDC to John");
            await usdcToken.transfer(john.address, parseUnits("5", usdcTokenDecimals));
        }
        if ((await usdcToken.balanceOf(alice.address)).lte(parseUnits("5", usdcTokenDecimals))) {
            console.log("Transferring USDC to Alice");
            await usdcToken.transfer(alice.address, parseUnits("5", usdcTokenDecimals));
        }

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
        // await initializeAndConnectToExistingContracts();
    })

    describe('Setup', () => {
        it("should initialize", async () => {
            expect(shareToken).to.be.ok;
            expect(xAsset).to.be.ok;
        })
    });

    async function withdrawHalfShares(owner: SignerWithAddress) {
        let ownedSharesBefore = await xAsset.getTotalSharesOwnedBy(owner.address);
        console.log('ownedShares', web3.utils.fromWei(ownedSharesBefore.toString()));
        const halfOwnedShares = ownedSharesBefore.div(BigNumber.from(2));

        // withdraw half of the shares
        await withdraw(owner, halfOwnedShares);
    }

    describe('Invest', () => {

        it('should allow users to invest a specific token amount', async () => {

            const sharesBefore = await shareToken.totalSupply();
            await invest(owner, usdc("1"));
            const sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter.sub(sharesBefore)).to.be.eq(BigNumber.from("8264462809917355371"));
        })

        it('should allow users to invest multiple tokens', async () => {

            let sharesBefore = await shareToken.totalSupply();
            await invest(owner, usdc("1"));
            let sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter.sub(sharesBefore)).to.be.eq(BigNumber.from("8264462809917355371"));

            sharesBefore = await shareToken.totalSupply();
            await invest(owner, usdt("1"), baseWalletsAndTokens.usdtToken?.address);
            sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter.sub(sharesBefore)).to.be.eq(BigNumber.from("8264462809917355371"));
        })

        it('should allow multiple users to invest a specific token amount', async () => {
            const amount = usdc("1");

            const sharesBefore = await shareToken.totalSupply();
            await invest(john, amount);
            const sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter.sub(sharesBefore)).to.be.eq(BigNumber.from("8264462809917355371"));

            await invest(alice, amount);
            const sharesAfter2 = await shareToken.totalSupply();

            expect(sharesAfter2.sub(sharesAfter)).to.be.eq(BigNumber.from("8264462809917355371"));
        })

        it('should calculate price per share with no investments in the XASSET', async () => {
            const sharePrice = await xAsset.getSharePrice();

            expect(sharePrice).to.be.eq(BigNumber.from("121000000000000000"));
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

            await invest(owner, amount);

            const pricePerShareAfter = await xAsset.getSharePrice();

            expect(pricePerShareBefore).to.be.eq(BigNumber.from("121000000000000000"));
            expect(pricePerShareAfter).to.be.eq(pricePerShareBefore);
        })

        it('should return new price once a new block is mined', async () => {
            const amount = usdc("10");
            await invest(owner, amount);
            let prices=[];
            let pricePerShareBefore = await xAsset.getSharePrice();
            expect(pricePerShareBefore).to.eq(BigNumber.from("121000000000000000"));
            prices.push(pricePerShareBefore);
            await mine(1000);
            let pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.eq(pricePerShareAfter);
            pricePerShareBefore = pricePerShareAfter;
            await mine(5000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.eq(pricePerShareAfter);
            pricePerShareBefore = pricePerShareAfter;
            await mine(7000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.eq(pricePerShareAfter);
            await mine(8000);
            pricePerShareAfter = await xAsset.getSharePrice();
            prices.push(pricePerShareAfter);
            expect(pricePerShareBefore).to.eq(pricePerShareAfter);
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

        it('should not allow users to withdraw', async () => {
            // invest 100 tokens
            const amount = usdc("1");
            await invest(john, amount);

            await time.increase(15*25*3600);

            await withdrawHalfShares(john);

        })

        it('should allow multiple users to invest but not withdraw at anytime', async () => {
            // invest 100 tokens
            const amount = usdc("0.1");
            await invest(john, amount);

            await time.increase(24*3600);

            await invest(alice, amount);

            await time.increase(24*3600);

            await invest(john, amount);

            await time.increase(24*3600);

            await withdraw(alice, await xAsset.getTotalSharesOwnedBy(alice.address));

            await time.increase(24*3600);

            await invest(alice, amount);

            await time.increase(15*25*3600);

            await invest(owner, amount);

            await withdrawHalfShares(john);

        })

        it('should calculate the total value owned by an address', async () => {
            const amount = usdc("1");

            // calculate how many $ the user has initially
            const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(john.address);

            // invest some tokens
            await invest(john, amount);

            // calculate how many $ the user has after investing
            const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(john.address);

            expect(valueOwnedAfter.sub(valueOwnedBefore).sub(amount).abs()).to.be.lte(2);
        })

        it('should calculate the amount of shares received for a specified token and amount', async () => {
            const amount = usdc("1");
            const shares = await xAsset.estimateSharesForInvestmentAmount(usdcToken.address, amount);

            expect(shares).to.eq(BigNumber.from("8264462809917355371"));
        })

    });
}).timeout(1000000000);
