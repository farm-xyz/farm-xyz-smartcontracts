import {
    ERC20,
    FarmConfigSet,
    FarmFixedRiskWallet,
    FarmXYZPlatformBridge,
    FarmXYZStrategy, MagpieStrategy,
    XAssetBase,
    XAssetMacros,
    XAssetShareToken
} from "../../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers, network, upgrades, web3} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {mine, time} from "@nomicfoundation/hardhat-network-helpers";
import {getPRBProxyRegistry, PRBProxy, PRBProxyRegistry} from "@prb/proxy";
import {executeViaProxy} from "../helpers/proxy";
import "hardhat-gas-reporter"
import {getProxyForSigner, initializeBaseWalletsAndTokens, setBaseWalletsAndTokens, usdc} from "../helpers/helpers";
import fs, {readFileSync} from "fs";
import {parseUnits} from "ethers/lib/utils";
// import {timeout} from "../helpers/utils";
import hardhatConfig, {default as networkConfig} from "../../hardhat.config";
import hre = require("hardhat");


describe.only("MagpieXYZProtocol XAssets", async () => {

    const forceRedeploy = false;

    let proxyRegistryAddress: string = "0x43fA1CFCacAe71492A36198EDAE602Fe80DdcA63";

    let totalRewardPool: BigNumber;

    let xAsset: XAssetBase;
    let shareToken: ERC20;
    let usdcToken: ERC20;
    let usdcTokenDecimals: number;

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

    async function invest(from: SignerWithAddress, amount:BigNumber) {
        let proxy = await getProxyForSigner(from);
        console.log('Invest via proxy: ', proxy.address);
        const transaction = await executeViaProxy(proxy, from, xassetMacros, 'investIntoXAsset', [xAsset.address, usdcToken.address, amount]);
        await transaction.wait();
        console.log("Invest tx hash: ", transaction.hash);
        console.log("Gas used: ", (await transaction.wait()).gasUsed);
        expect(transaction).to.not.be.revertedWith('ERC20: transfer amount exceeds balance');
    }

    async function withdraw(from: SignerWithAddress, shares:BigNumber) {
        let proxy = await getProxyForSigner(from);
        const transaction = await executeViaProxy(proxy, from, xassetMacros, 'withdrawFromXAsset', [xAsset.address, shares]);
        await transaction.wait();
        console.log("Withdraw tx hash: ", transaction.hash);
        console.log("Gas used: ", (await transaction.wait()).gasUsed);
        expect(transaction).to.be.ok;
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

    async function initialize() {
        readConfig();
        console.log("Initializing contracts");
        let baseWalletsAndTokens = await initializeBaseWalletsAndTokens();
        usdcToken = baseWalletsAndTokens.usdcToken;
        usdcTokenDecimals = baseWalletsAndTokens.usdcTokenDecimals;
        owner = baseWalletsAndTokens.owner;
        john = baseWalletsAndTokens.john;
        alice = baseWalletsAndTokens.alice;

        console.log("Reading proxy");
        ownerProxy = await getProxyForSigner(owner);

        const MagpieStrategyFactory = await ethers.getContractFactory("MagpieStrategy");
        const XAssetBase = await ethers.getContractFactory("XAssetBase");
        // const XAssetBaseV2 = await ethers.getContractFactory("XAssetBaseV2");
        const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
        const XAssetMacros = await ethers.getContractFactory("XAssetMacros");


        // Then let's initialize the reward farm

        let strategy: MagpieStrategy;

        if (forceRedeploy || !config['MagpieStrategy']) {
            strategy = await upgrades.deployProxy(MagpieStrategyFactory,
                [
                    usdcToken.address,
                    // "0x1aa1E18FAFAe4391FF33dFBE6198dc84B9541D77", // Magpie USDT Helper
                    "0xb68F5247f31fe28FDe0b0F7543F635a4d6EDbD7F", // Magpie USDC Helper
                    "0x312Bc7eAAF93f1C60Dc5AfC115FcCDE161055fb0", // WombatPool
                    "0xAD6742A35fB341A9Cc6ad674738Dd8da98b94Fb1" // womToken
                ],
                {kind: "uups"}) as MagpieStrategy;
            await strategy.deployed();
            config['MagpieStrategy'] = strategy.address;
            saveConfig();
            console.log("MagpieStrategy deployed to:", strategy.address);
        } else {
            strategy = MagpieStrategyFactory.attach(config['MagpieStrategy']) as MagpieStrategy;
        }

        let _shareToken;
        if (forceRedeploy || !config['XAssetShareToken']) {
            _shareToken = await upgrades.deployProxy(XAssetShareToken,
                ["X-MAGPIE-USDC XASSET", "X-USDC", proxyRegistryAddress],
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
                ["X-USDC", usdcToken.address, _shareToken.address, proxyRegistryAddress],
                {kind: "uups"});
            await xassetProxy.deployed();
            config['XAssetBase'] = xassetProxy.address;
            saveConfig();
            console.log("XAssetBase deployed to:", xassetProxy.address);
        } else {
            xassetProxy = XAssetBase.attach(config['XAssetBase']) as XAssetBase;
            console.log("XAssetBase attached to:", xassetProxy.address);

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
            await usdcToken.transfer(xassetProxy.address, usdc("10"));
            await (xassetProxy as XAssetBase)["executeInitialInvestment()"]();
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
        if (john && (await usdcToken.balanceOf(john.address)).lte(parseUnits("10", usdcTokenDecimals))) {
            console.log("Transferring USDC to John");
            await usdcToken.transfer(john.address, parseUnits("10", usdcTokenDecimals));
        }
        if (alice && (await usdcToken.balanceOf(alice.address)).lte(parseUnits("10", usdcTokenDecimals))) {
            console.log("Transferring USDC to Alice");
            await usdcToken.transfer(alice.address, parseUnits("10", usdcTokenDecimals));
        }

        await Promise.all([
            strategy.deployed(),
            xassetProxy.deployed(),
        ]);

        xAsset = xassetProxy as XAssetBase;
    }

    beforeEach(async () => {

        // console.log(networkConfig.networks?.hardhat?.forking);

        // reset fork
        if (network.name=="hardhat") {
            await network.provider.request({
                method: "hardhat_reset",
                params: [
                    {
                        forking: {
                            jsonRpcUrl: networkConfig.networks?.hardhat?.forking?.url,
                            blockNumber: hardhatConfig.networks?.hardhat?.forking?.blockNumber
                        },
                    },
                ],
            });
        }

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


    async function withdrawHalfShares(owner: SignerWithAddress) {
        // const valueBeforeWithdraw = await xAsset.getTotalValueOwnedBy(owner.address);

        let ownedShares = await xAsset.getTotalSharesOwnedBy(owner.address);
        console.log('ownedShares', web3.utils.fromWei(ownedShares.toString()));
        const halfOwnedShares = ownedShares.div(BigNumber.from(2));

        // withdraw half of the shares
        await withdraw(owner, halfOwnedShares);
        // TODO: check balances!!!!

        ownedShares = await xAsset.getTotalSharesOwnedBy(owner.address);
        console.log('ownedShares after', web3.utils.fromWei(ownedShares.toString()));

        expect(ownedShares.sub(halfOwnedShares).abs()).to.be.lt(2);
    }

    describe('Invest', () => {

        it('should allow users to invest a specific token amount', async () => {

            // print owner balance of usdc
            const ownerBalance = await usdcToken.balanceOf(owner.address);
            console.log('ownerBalance', web3.utils.fromWei(ownerBalance.toString()));

            const sharesBefore = await shareToken.totalSupply();
            await invest(owner, usdc("2"));
            const sharesAfter = await shareToken.totalSupply();
            const valueAfter = await xAsset.getTotalValueOwnedBy(owner.address);
            console.log('valueAfter', web3.utils.fromWei(valueAfter.toString()));

            expect(sharesAfter).to.greaterThan(sharesBefore);
        })

        it('should allow multiple users to invest a specific token amount', async () => {
            const amount = usdc("1");

            const sharesBefore = await shareToken.totalSupply();
            await invest(john, amount);
            const sharesAfter = await shareToken.totalSupply();

            expect(sharesAfter).to.greaterThan(sharesBefore);

            await invest(alice, amount);
            const sharesAfter2 = await shareToken.totalSupply();

            expect(sharesAfter2).to.greaterThan(sharesAfter);
        })

        it('should allocate shares for the specific investment', async () => {
            const amount = usdc("1");

            const sharesBefore = await xAsset.getTotalSharesOwnedBy(john.address);
            await invest(john, amount);
            const sharesAfter = await xAsset.getTotalSharesOwnedBy(john.address);

            expect(sharesAfter).to.greaterThan(sharesBefore);
        })

        it('should calculate price per share with no investments in the XASSET', async () => {
            const sharePrice = await xAsset.getSharePrice();

            expect(sharePrice).to.greaterThan("0");
        })

        it('should revert if not using proxy', async () => {
            const amount = usdc("1");

            expect(xAsset.connect(owner).invest(usdcToken.address, amount)).to.be.revertedWith('ERC20: transfer amount exceeds balance');
        })

        it('should not revert if using proxy', async () => {
            const amount = usdc("1");

            console.log('owner address:', owner.address);
            await invest(owner, amount);
        })

        it('should calculate price per share', async () => {
            const amount = usdc("1");
            const pricePerShareBefore = await xAsset.getSharePrice();

            await invest(owner, amount);

            const pricePerShareAfter = await xAsset.getSharePrice();

            expect(pricePerShareBefore).to.be.gt(0);
            expect(pricePerShareAfter).to.be.gt(0);
        })

        it('should return new price once a new block is mined', async () => {
            const amount = usdc("1");
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
            const amount = usdc("1");
            const tvlBefore = await xAsset.getTVL();

            await invest(john, amount);

            const tvlAfter = await xAsset.getTVL();

            expect(tvlAfter.sub(tvlBefore)).to.be.gte(amount);

            await invest(owner, amount);

            const tvlAfter2 = await xAsset.getTVL();

            expect(tvlAfter2).to.be.gte(amount.mul(2));
        })

        it('should return total number of shares minted', async () => {
            const amount = usdc("1");
            await invest(john, amount);

            const totalShares = await shareToken.totalSupply();

            expect(totalShares).to.greaterThan(0);
        })

        it('should allow users to withdraw a specific amount of shares and receive an amount of tokens', async () => {
            // invest 100 tokens
            const amount = usdc("1");
            await invest(john, amount);

            await time.increase(15*25*3600);

            await withdrawHalfShares(john);

        })

        it('should allow multiple users to invest and withdraw at anytime', async () => {
            // invest 100 tokens
            const amount = usdc("1");
            await invest(john, amount);
            let balanceBefore = await usdcToken.balanceOf(john.address);
            hre.tracer.enabled = true;
            await withdraw(john, await xAsset.getTotalSharesOwnedBy(john.address));
            hre.tracer.enabled = false;
            let balanceAfter = await usdcToken.balanceOf(john.address);
            console.log('john balance before', web3.utils.fromWei(balanceBefore.toString()));
            console.log('john balance after', web3.utils.fromWei(balanceAfter.toString()));
            console.log('john balance diff', web3.utils.fromWei(balanceAfter.sub(balanceBefore).toString()));
            expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);

            await time.increase(24*3600);

            await invest(alice, amount);

            await time.increase(24*3600);

            await invest(john, amount);

            await time.increase(24*3600);

            balanceBefore = await usdcToken.balanceOf(alice.address);
            await withdraw(alice, await xAsset.getTotalSharesOwnedBy(alice.address));
            balanceAfter = await usdcToken.balanceOf(alice.address);
            console.log('alice balance before', web3.utils.fromWei(balanceBefore.toString()));
            console.log('alice balance after', web3.utils.fromWei(balanceAfter.toString()));
            console.log('alice balance diff', web3.utils.fromWei(balanceAfter.sub(balanceBefore).toString()));
            expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);

            await time.increase(24*3600);

            await invest(alice, amount);

            await time.increase(15*25*3600);

            await invest(owner, amount);

            balanceBefore = await usdcToken.balanceOf(john.address);
            console.log('john balance before', web3.utils.fromWei(balanceBefore.toString()));
            await withdrawHalfShares(john);
            balanceAfter = await usdcToken.balanceOf(john.address);
            console.log('john balance after', web3.utils.fromWei(balanceAfter.toString()));
            console.log('john balance diff', web3.utils.fromWei(balanceAfter.sub(balanceBefore).toString()));
            expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);
        })

        it('should calculate the total value owned by an address', async () => {
            const amount = usdc("1");

            // calculate how many $ the user has initially
            const valueOwnedBefore = await xAsset.getTotalValueOwnedBy(john.address);

            // invest some tokens
            await invest(john, amount);

            // calculate how many $ the user has after investing
            const valueOwnedAfter = await xAsset.getTotalValueOwnedBy(john.address);
            let diff = valueOwnedAfter.sub(valueOwnedBefore.add(amount));

            expect(diff).to.be.lte(1000);
        })

        it('should calculate the amount of shares received for a specified token and amount', async () => {
            const amount = usdc("1");
            const shares = await xAsset.estimateSharesForInvestmentAmount(usdcToken.address, amount);

            expect(shares).to.greaterThan("0");
        })

        it.only('should test withdrawal on mainnet', async () => {
            // invest 100 tokens
            const amount = usdc("25");
            await invest(owner, amount);
            let balanceBefore = await usdcToken.balanceOf(owner.address);
            // hre.tracer.enabled = true;
            await withdraw(owner, await xAsset.getTotalSharesOwnedBy(owner.address));
            // hre.tracer.enabled = false;
            let balanceAfter = await usdcToken.balanceOf(owner.address);
            console.log('owner balance before', web3.utils.fromWei(balanceBefore.toString()));
            console.log('owner balance after', web3.utils.fromWei(balanceAfter.toString()));
            console.log('owner balance diff', web3.utils.fromWei(balanceAfter.sub(balanceBefore).toString()));
            expect(balanceAfter.sub(balanceBefore)).to.be.gt(0);
        })



    });
}).timeout(1000000000);
