import { ethers, upgrades } from "hardhat";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber, BigNumberish} from "ethers";
import {ERC20, FarmConfigSet, FarmFixedRiskWallet, XAssetBase, XAssetShareToken} from "../../typechain";
import hre = require("hardhat");
import {timeout} from "../../test/helpers/utils";
import {getPRBProxyRegistry, PRBProxyRegistry} from "@prb/proxy";
import fs, {readFileSync} from "fs";

let stableCoins:{ [key: string]: { [key: string]: any } } = {
    'hardhat': { // hardhat clone of polygon mainnet
        'USDC': {
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            contract: null
        },
        'USDT': {
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            contract: null
        },
        'DAI': {
            address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            contract: null
        },
        'FRAX': {
            address: '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89',
            contract: null
        },
        'agEUR': {
            address: '0xE0B52e49357Fd4DAf2c15e02058DCE6BC0057db4',
            contract: null
        },
        'miMATIC': {
            address: '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1',
            contract: null
        }
    },
    'polygon': { // polygon mainnet
        'USDC': {
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            contract: null
        },
        'USDT': {
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            contract: null
        },
        'DAI': {
            address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            contract: null
        },
        'FRAX': {
            address: '0x45c32fA6DF82ead1e2EF74d17b76547EDdFaFF89',
            contract: null
        },
        'agEUR': {
            address: '0xE0B52e49357Fd4DAf2c15e02058DCE6BC0057db4',
            contract: null
        },
        'miMATIC': {
            address: '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1',
            contract: null
        }
    },
    'mumbai': { // polygon mumbai uses a TestToken instance for all of them
        'USDC': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        },
        'USDT': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        },
        'DAI': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        },
        'FRAX': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        },
        'agEUR': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        },
        'miMATIC': {
            address: '0x85111aF7Af9d768D928d8E0f893E793625C00bd1',
            contract: null
        }
    }
};

let config: { [key: string]: { [key: string]: any } } = {};

function readConfig() {
    try {
        let configJson = readFileSync('deploy.json', 'utf-8');
        config = JSON.parse(configJson);
    } catch (e) {
        config = {};
    }
}

function saveConfig() {
    let configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync('deploy.json', configJson);
}

function saveValue(key:string, value:any) {
    if (!config[hre.network.name]) config[hre.network.name] = {};
    config[hre.network.name][key]=value;
    saveConfig();
}

function getValue(key:string) {
    if (config[hre.network.name] && config[hre.network.name][key])
        return config[hre.network.name][key];
    return null;
}

function getXAssetValue(xAssetData: { ticker: string}, key:string) {
    const xAssetValuePrefix = 'XAsset-'+xAssetData.ticker;
    let value = getValue(xAssetValuePrefix);
    if (value && value[key])
        return value[key];
    return null;
}

function saveXAssetValue(xAssetData: { ticker: string}, key:string, value:any) {
    const xAssetValuePrefix = 'XAsset-'+xAssetData.ticker;
    if (!config[hre.network.name]) config[hre.network.name] = {};
    if (!config[hre.network.name][xAssetValuePrefix]) config[hre.network.name][xAssetValuePrefix] = {};
    config[hre.network.name][xAssetValuePrefix][key]=value;
    saveConfig();
}

function unsetConfigKeys(keys:string[]) {
    for (let i = 0; i < keys.length; i++) {
        if (config[hre.network.name])
            delete config[hre.network.name][keys[i]];
    }
    saveConfig();
}

async function deployXAsset(xAssetData: { name: string, ticker: string, stableCoin:ERC20, rewardPool: BigNumberish, returnsPeriod: BigNumberish },
                            farmXYZConfigSet: FarmConfigSet,
                            resume: boolean = false) {

    console.group('Deploying XAsset', xAssetData.name);

    if (!resume)
        unsetConfigKeys(['latest_ticker', 'latest_FarmFixedRiskWallet', 'latest_FarmFixedRiskWalletSetup',
                            'latest_FarmXYZPlatformBridge', 'latest_FarmXYZStrategy', 'latest_FarmXYZStrategyWhitelisted',
                            'latest_XAssetShareToken', 'latest_XAssetBase', 'latest_XAssetBaseSetup']);
    saveValue('latest_ticker', xAssetData.ticker);

    let usdcToken = xAssetData.stableCoin;

    let farmXYZFarm;
    const FarmFixedRiskWalletFactory = await ethers.getContractFactory("FarmFixedRiskWallet");
    if (resume && getXAssetValue(xAssetData, 'FarmFixedRiskWallet') == null) {
        console.log("Deploying FarmFixedRiskWallet...");
        const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWalletFactory,
            [usdcToken.address, farmXYZConfigSet.address],
            {kind: "uups"});
        farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
        await farmXYZFarm.deployed();
        console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
        saveXAssetValue(xAssetData, 'FarmFixedRiskWallet', farmXYZFarm.address);
    } else {
        console.log("FarmFixedRiskWallet already deployed");
        farmXYZFarm = FarmFixedRiskWalletFactory.attach(getXAssetValue(xAssetData, 'FarmFixedRiskWallet')) as FarmFixedRiskWallet;
    }

    if (resume && getXAssetValue(xAssetData, 'FarmFixedRiskWalletSetup') == null) {
        console.log("Setting up FarmFixedRiskWallet...");
        await usdcToken.approve(farmXYZFarm.address, xAssetData.rewardPool);
        await farmXYZFarm.depositToReturnsPool(xAssetData.rewardPool);
        await farmXYZConfigSet.loadConfigs([{farm: farmXYZFarm.address, returnsPeriod: xAssetData.returnsPeriod}]);
        await farmXYZFarm.setWhitelistEnabled(true);
        console.log("FarmFixedRiskWallet setup done.");
        saveXAssetValue(xAssetData, 'FarmFixedRiskWalletSetup', true);
    } else {
        console.log("FarmFixedRiskWallet already setup");
    }


    const FarmXYZPlatformBridgeFactory = await ethers.getContractFactory("FarmXYZPlatformBridge");
    const FarmXYZStrategyFactory = await ethers.getContractFactory("FarmXYZStrategy");
    const XAssetBaseFactory = await ethers.getContractFactory("XAssetBase");
    const XAssetShareTokenFactory = await ethers.getContractFactory("XAssetShareToken");


    let bridge;
    if (resume && getXAssetValue(xAssetData, 'FarmXYZPlatformBridge') == null) {
        console.log("Deploying FarmXYZPlatformBridge...");
        bridge = await upgrades.deployProxy(FarmXYZPlatformBridgeFactory, [], {kind: "uups"});
        await bridge.deployed();
        console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
        saveXAssetValue(xAssetData, 'FarmXYZPlatformBridge', bridge.address);
    } else {
        console.log("FarmXYZPlatformBridge already deployed");
        bridge = FarmXYZPlatformBridgeFactory.attach(getXAssetValue(xAssetData, 'FarmXYZPlatformBridge'));
    }

    let strategy;
    if (resume && getXAssetValue(xAssetData, 'FarmXYZStrategy') == null) {
        console.log("Deploying FarmXYZStrategy...");
        strategy = await upgrades.deployProxy(FarmXYZStrategyFactory,
            [bridge.address, farmXYZFarm.address, usdcToken.address],
            {kind: "uups"});
        await strategy.deployed();
        saveXAssetValue(xAssetData, 'FarmXYZStrategy', strategy.address);
        console.log("FarmXYZStrategy deployed to:", strategy.address);
    } else {
        console.log("FarmXYZStrategy already deployed");
        strategy = FarmXYZStrategyFactory.attach(getXAssetValue(xAssetData, 'FarmXYZStrategy'));
    }

    if (resume && getXAssetValue(xAssetData, 'FarmXYZStrategyWhitelisted') == null) {
        console.log("Adding FarmXYZStrategy to whitelist..");
        await farmXYZFarm.addToWhitelist([strategy.address]);
        saveXAssetValue(xAssetData, 'FarmXYZStrategyWhitelisted', true);
        console.log("FarmXYZStrategy added to whitelist.");
    } else {
        console.log("FarmXYZStrategy already whitelisted");
    }


    let shareToken:XAssetShareToken;
    if (resume && getXAssetValue(xAssetData, 'XAssetShareToken') == null) {
        console.log("Deploying XAssetShareToken...");
        shareToken = await upgrades.deployProxy(XAssetShareTokenFactory,
            [xAssetData.name, xAssetData.ticker],
            {kind: "uups"}) as XAssetShareToken;
        await shareToken.deployed();
        saveXAssetValue(xAssetData, 'XAssetShareToken', shareToken.address);
        console.log("XAssetShareToken deployed to:", shareToken.address);
    } else {
        console.log("XAssetShareToken already deployed");
        shareToken = XAssetShareTokenFactory.attach(getXAssetValue(xAssetData, 'XAssetShareToken')) as XAssetShareToken;
    }

    let xasset:XAssetBase;
    if (resume && getXAssetValue(xAssetData, 'XAssetBase') == null) {
        console.log("Deploying XAssetBase...");
        xasset = await upgrades.deployProxy(XAssetBaseFactory,
            [xAssetData.ticker, usdcToken.address, shareToken.address],
            {kind: "uups"}) as XAssetBase;
        await xasset.deployed();
        saveXAssetValue(xAssetData, 'XAssetBase', xasset.address);
        console.log("XAssetBase deployed to:", xasset.address);
    } else {
        console.log("XAssetBase already deployed");
        xasset = XAssetBaseFactory.attach(getXAssetValue(xAssetData, 'XAssetBase')) as XAssetBase;
    }

    if (resume && getXAssetValue(xAssetData, 'XAssetBaseSetup') == null) {
        console.log("Setting up XAssetBase...");
        console.log("Share token xasset: ", (await shareToken.xAsset()).toString());
        if ((await shareToken.xAsset()).toString()=='0x0000000000000000000000000000000000000000') {
            await shareToken.setXAsset(xasset.address);
            await xasset.setStrategy(strategy.address);
        }
        let initialInvestmentSum = parseUnits("10", await usdcToken.decimals());
        if ((await usdcToken.balanceOf(xasset.address)).lt(initialInvestmentSum) ) {
            console.log("Transferring initial investment sum to XAssetBase...");
            await usdcToken.transfer(xasset.address, initialInvestmentSum);
            console.log("Balance of xasset after transfer: ", (await usdcToken.balanceOf(xasset.address)).toString());
        } else {
            console.log("Initial investment sum already transferred to XAssetBase");
        }
        await xasset.executeInitialInvestment();
        saveXAssetValue(xAssetData, 'XAssetBaseSetup', true);
        console.log("XAssetBase setup complete");
    } else {
        console.log("XAssetBase already setup");
    }

    // saveValue('XAsset-'+xAssetData.ticker, {
    //     'FarmConfigSet': farmXYZConfigSet.address,
    //     'FarmFixedRiskWallet': farmXYZFarm.address,
    //     'FarmFixedRiskWalletSetup': true,
    //     'FarmXYZPlatformBridge': bridge.address,
    //     'FarmXYZStrategy': strategy.address,
    //     'FarmXYZStrategyWhitelisted': true,
    //     'XAssetBase': xasset.address,
    //     'XAssetBaseSetup': true,
    //     'XAssetShareToken': shareToken.address,
    // });

    console.log("USDC Token deployed to:", usdcToken.address);
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);
    console.log("XAssetBase deployed to:", xasset.address);

    console.groupEnd();
}

async function main() {
    readConfig();

    console.log("Deploying to network: ", hre.network.name);

    if (hre.network.name == 'hardhat') {
        config[hre.network.name] = config['polygon'];
    }

    const [ owner ] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("ERC20");
    for(let [key, token] of Object.entries(stableCoins[hre.network.name])) {
        stableCoins[hre.network.name][key].contract = ERC20Factory.attach(token.address);
    }

    // <editor-fold desc="// Deploy Test Token">
    // if (false) { // Deploy a test token to be used as stableCoin
    //     console.log("Deploying TestUSDC...");
    //     const TestTokenFactory = await ethers.getContractFactory("TestToken");
    //     usdcToken = await TestTokenFactory.deploy("Test: USDC Coin", "USDC");
    //     await usdcToken.deployed();
    //     console.log("TestUSDC deployed to:", usdcToken.address);
    //
    //     console.log("Minting some TestUSDC...");
    //     await usdcToken.mint(owner.address, parseUnits("1000000000", await usdcToken.decimals()));
    // }
    // </editor-fold>

    let xassetMacros;
    const XAssetMacrosFactory = await ethers.getContractFactory("XAssetMacros");

    if (getValue('XAssetMacros') == null) {
        // Now that all those are done let's initialize the macros contract
        console.log("Deploying XAssetMacros...");
        xassetMacros = await XAssetMacrosFactory.deploy();
        await xassetMacros.deployed();
        saveValue('XAssetMacros', xassetMacros.address);
        console.log("XAssetMacros deployed to:", xassetMacros.address);
    } else {
        console.log("XAssetMacros already deployed");
        xassetMacros = XAssetMacrosFactory.attach(getValue('XAssetMacros'));
    }

    let farmXYZConfigSet;
    const FarmConfigSetFactory = await ethers.getContractFactory("FarmConfigSet");
    if (getValue('FarmConfigSet') == null) {
        console.log("Deploying FarmConfigSet...");
        const farmXYZConfigSetProxy = await upgrades.deployProxy(FarmConfigSetFactory,
            [],
            {kind: "uups"});
        farmXYZConfigSet = farmXYZConfigSetProxy as FarmConfigSet;
        await farmXYZConfigSet.deployed();
        saveValue('FarmConfigSet', farmXYZConfigSet.address);
        console.log("FarmConfigSet deployed to:", farmXYZConfigSet.address);
    } else {
        console.log("FarmConfigSet already deployed");
        farmXYZConfigSet = FarmConfigSetFactory.attach(getValue('FarmConfigSet'));
    }

    let xAssetsData = [
        {
            name: "X-USDC",
            ticker: "X-USDC",
            stableCoin: stableCoins[hre.network.name].USDC.contract,
            rewardPool: parseUnits("100", await stableCoins[hre.network.name].USDC.contract.decimals()),
            returnsPeriod: BigNumber.from(31*24*3600)
        },
        {
            name: "X-USDT",
            ticker: "X-USDT",
            stableCoin: stableCoins[hre.network.name].USDT.contract,
            rewardPool: parseUnits("100", await stableCoins[hre.network.name].USDT.contract.decimals()),
            returnsPeriod: BigNumber.from(30*24*3600)
        },
        {
            name: "X-DAI",
            ticker: "X-DAI",
            stableCoin: stableCoins[hre.network.name].DAI.contract,
            rewardPool: parseUnits("100", await stableCoins[hre.network.name].DAI.contract.decimals()),
            returnsPeriod: BigNumber.from(37*24*3600)
        },
        {
            name: "X-FRAX",
            ticker: "X-FRAX",
            stableCoin: stableCoins[hre.network.name].FRAX.contract,
            rewardPool: parseUnits("100", await stableCoins[hre.network.name].FRAX.contract.decimals()),
            returnsPeriod: BigNumber.from(45*24*3600)
        }
    ];

    for (let i = 0; i < xAssetsData.length; i++) {
        await deployXAsset(xAssetsData[i], farmXYZConfigSet, true);
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
