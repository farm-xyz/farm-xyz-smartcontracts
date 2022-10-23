import {
    ERC20,
    FarmFixedRiskWallet,
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
import {getProxyForSigner, initializeBaseWalletsAndTokens, setBaseWalletsAndTokens, usdc} from "../helpers/helpers";
import fs, {readFileSync} from "fs";
import {parseUnits} from "ethers/lib/utils";
import {timeout} from "../helpers/utils";
import hre = require("hardhat");


describe.only("FarmXYZProtocol XAssets", async () => {

    const forceRedeploy = true;

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

    async function macroTest(from: SignerWithAddress, amount:BigNumber) {
        let proxy = await getProxyForSigner(from);
        console.log('Invest via proxy: ', proxy.address);
        const transaction = await executeViaProxy(proxy, from, xassetMacros, 'macroTest', [xAsset.address, usdcToken.address, amount]);
        expect(transaction).to.not.be.revertedWith('ERC20: transfer amount exceeds balance');
        console.log("Sent tx hash: ", transaction.hash);
    }

    async function invest(from: SignerWithAddress, amount:BigNumber) {
        let proxy = await getProxyForSigner(from);
        console.log('Invest via proxy: ', proxy.address);
        expect(await executeViaProxy(proxy, from, xassetMacros, 'investIntoXAsset', [xAsset.address, usdcToken.address, amount])).to.not.be.revertedWith('ERC20: transfer amount exceeds balance');
    }

    async function withdraw(from: SignerWithAddress, shares:BigNumber) {
        let proxy = await getProxyForSigner(from);
        expect(await executeViaProxy(proxy, from, xassetMacros, 'withdrawFromXAsset', [xAsset.address, shares])).to.not.be.reverted;
    }

    let config: { [key: string]: any } = {};

    function readConfig() {
        try {
            let configJson = readFileSync('config.json', 'utf-8');
            config = JSON.parse(configJson);
        } catch (e) {
            config = {};
        }
    }

    function saveConfig() {
        if (hre.network.name=== 'hardhat') return;
        let configJson = JSON.stringify(config);
        fs.writeFileSync('config.json', configJson);
    }

    async function initializeAndConnectToExistingContracts()
    {
        [owner, john, alice] = await ethers.getSigners();
        const ERC20Factory = await ethers.getContractFactory("ERC20");
        usdcToken = await ERC20Factory.attach('0x85111aF7Af9d768D928d8E0f893E793625C00bd1');
        usdcTokenDecimals = 18; //baseWalletsAndTokens.usdcTokenDecimals;
        const registry: PRBProxyRegistry = getPRBProxyRegistry(owner);

        setBaseWalletsAndTokens({usdcToken, usdcTokenDecimals, registry, owner, john, alice});

        ownerProxy = await getProxyForSigner(owner);

        totalRewardPool = usdc("1000000");
        const returnsPaybackPeriod = BigNumber.from(365*2*24*3600);

        // Then let's initialize the reward farm

        // Now let's initialize the XAsset
        const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
        const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
        const XAssetMacros = await ethers.getContractFactory("XAssetMacros");

        const xassetProxy = await XAssetBase.attach("0x0416fD0A193b5a0BE3d26e733039A85c21B58637") as XAssetBase;
        xassetMacros = await XAssetMacros.attach("0xEcB8Fd8a34FF859745a0F0fFd5048e195C6F1DAb") as XAssetMacros;
        shareToken = await XAssetShareToken.attach(await xassetProxy.shareToken()) as XAssetShareToken;

        await Promise.all([
            xassetProxy.deployed(),
        ]);

        xAsset = xassetProxy as XAssetBase;
    }

    async function initialize() {
        readConfig();
        let baseWalletsAndTokens = await initializeBaseWalletsAndTokens();
        usdcToken = baseWalletsAndTokens.usdcToken;
        usdcTokenDecimals = baseWalletsAndTokens.usdcTokenDecimals;
        owner = baseWalletsAndTokens.owner;
        john = baseWalletsAndTokens.john;
        alice = baseWalletsAndTokens.alice;

        ownerProxy = await getProxyForSigner(owner);

        totalRewardPool = usdc("1000000");
        const returnsPaybackPeriod = BigNumber.from(365*2*24*3600);

        const FarmFixedRiskWallet = await ethers.getContractFactory("FarmFixedRiskWallet");
        const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
        const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        const XAssetBaseV2 = await ethers.getContractFactory("XAssetBaseV2");
        const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
        const XAssetMacros = await ethers.getContractFactory("XAssetMacros");

        let farmXYZFarm;

        // Then let's initialize the reward farm
        if (!forceRedeploy && config['FarmFixedRiskWallet']) {
            farmXYZFarm = FarmFixedRiskWallet.attach(config['FarmFixedRiskWallet']) as FarmFixedRiskWallet;
        } else {
            const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWallet,
                [usdcToken.address],
                {kind: "uups"});
            farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
            await farmXYZFarm.deployed();
            config['FarmFixedRiskWallet'] = farmXYZFarm.address;
            saveConfig();
            console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
        }

        if (forceRedeploy || !config['FarmFixedRiskWalletInitialised']) {
            await usdcToken.approve(farmXYZFarm.address, totalRewardPool);
            await farmXYZFarm.depositToReturnsPool(totalRewardPool);
            await farmXYZFarm.setPaybackPeriod(returnsPaybackPeriod);
            await farmXYZFarm.setWhitelistEnabled(true);
            config['FarmFixedRiskWalletInitialised'] = true;
            saveConfig();
        }

        console.log("FarmFixedRiskWallet configured");

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
            _shareToken = await upgrades.deployProxy(XAssetShareToken,
                ["X-DAI/USDC/USDT XASSET", "X-DAI-USDC-USDT"],
                {kind: "uups"});
            await _shareToken.deployed();
            config['XAssetShareToken'] = _shareToken.address;
            saveConfig();
            console.log("XAssetShareToken deployed to:", _shareToken.address);
        } else {
            _shareToken = XAssetShareToken.attach(config['XAssetShareToken']) as XAssetShareToken;
        }


        shareToken = _shareToken as ERC20;

        let xassetProxy;
        if (forceRedeploy || !config['XAssetBase']) {
            xassetProxy = await upgrades.deployProxy(XAssetBase,
                ["X-DAI-USDC-USDT", usdcToken.address, _shareToken.address],
                {kind: "uups"});
            await xassetProxy.deployed();
            config['XAssetBase'] = xassetProxy.address;
            saveConfig();
            console.log("XAssetBase deployed to:", xassetProxy.address);
        } else {
            xassetProxy = XAssetBase.attach(config['XAssetBase']) as XAssetBase;

            if (config['upgrade'] && config['upgrade']['XAssetBase']) {
                console.log("Upgrading XAssetBase contract at", xassetProxy.address);
                const oldContract = await upgrades.forceImport(config['XAssetBase'], XAssetBase, { kind: "uups" });
                xassetProxy = await upgrades.upgradeProxy(xassetProxy.address, XAssetBaseV2, {kind: "uups"});
            }

        }

        if (forceRedeploy || !config['XAssetBaseInitialised']) {
            await _shareToken.setXAsset(xassetProxy.address);
            await (xassetProxy as XAssetBase).setStrategy(strategy.address);
            await usdcToken.transfer(xassetProxy.address, usdc("10"));
            await (xassetProxy as XAssetBase).executeInitialInvestment();
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
        if ((await usdcToken.balanceOf(john.address)).lte(parseUnits("10000", usdcTokenDecimals))) {
            console.log("Transferring USDC to John");
            await usdcToken.transfer(john.address, parseUnits("10000", usdcTokenDecimals));
        }
        if ((await usdcToken.balanceOf(alice.address)).lte(parseUnits("10000", usdcTokenDecimals))) {
            console.log("Transferring USDC to Alice");
            await usdcToken.transfer(alice.address, parseUnits("10000", usdcTokenDecimals));
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

    describe('Test Macros Contract via proxy', () => {
        it('should be able to call a function via proxy', async () => {

            await macroTest(owner, usdc("10"));

        })
    });


    describe('Invest', () => {

        it('should allow users to invest a specific token amount', async () => {

            const sharesBefore = await shareToken.totalSupply();
            await invest(owner, usdc("10"));
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

            await time.increase(15*25*3600);

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

        it('should allow multiple users to invest and withdraw at anytime', async () => {
            // invest 100 tokens
            const amount = usdc("100");
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
}).timeout(1000000000);
