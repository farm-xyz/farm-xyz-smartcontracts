import { ethers, upgrades } from "hardhat";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber, BigNumberish} from "ethers";
import {ERC20, FarmConfigSet, FarmFixedRiskWallet, XAssetBase, XAssetShareToken} from "../../typechain";
import hre = require("hardhat");
import {timeout} from "../../test/helpers/utils";
import {getPRBProxyRegistry, PRBProxyRegistry} from "@prb/proxy";
import fs, {readFileSync} from "fs";
import {usdc} from "../../test/helpers/helpers";

let proxyRegistryAddress: string = "0x43fA1CFCacAe71492A36198EDAE602Fe80DdcA63";

let stableCoins:{ [key: string]: { [key: string]: any } } = {
    'hardhat': { /* will be updated from main */ },
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
    },
    'bsc': { // bsc mainnet
        'USDC': {
            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            contract: null
        },
        'USDT': {
            address: '0x55d398326f99059ff775485246999027b3197955',
            contract: null
        },
        'DAI': {
            address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
            contract: null
        },
        'BUSD': {
            address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
            contract: null
        }
    }
};

let config: { [key: string]: { [key: string]: any } } = {};

function readConfig() {
    try {
        let configJson = readFileSync('deploy-farmx-token.json', 'utf-8');
        config = JSON.parse(configJson);
    } catch (e) {
        config = {};
    }
}

function saveConfig() {
    let configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync('deploy-farmx-token.json', configJson);
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

async function deployFarmInvestmentXAsset(xAssetData: { name: string, ticker: string, stableCoins:ERC20[] },
                            resume: boolean = false) {

    console.group('Deploying XAsset', xAssetData.name);

    if (!resume)
        unsetConfigKeys(['latest_ticker', 'latest_FarmFixedRiskWallet', 'latest_FarmFixedRiskWalletSetup',
                            'latest_FarmXYZPlatformBridge', 'latest_FarmXYZStrategy', 'latest_FarmXYZStrategyWhitelisted',
                            'latest_XAssetShareToken', 'latest_XAssetBase', 'latest_XAssetBaseSetup']);
    saveValue('latest_ticker', xAssetData.ticker);

    let usdcToken = xAssetData.stableCoins[0];

    const FarmInvestableWalletFactory = await ethers.getContractFactory("FarmInvestableWallet");
    const FarmXYZStrategyFactory = await ethers.getContractFactory("FarmXYZStrategy");
    const FarmXYZPlatformBridgeFactory = await ethers.getContractFactory("FarmXYZPlatformBridge");
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

    let wallet;
    if (resume && getXAssetValue(xAssetData, 'FarmInvestableWallet') == null) {
        console.log("Deploying FarmInvestableWallet...");
        wallet = await upgrades.deployProxy(FarmInvestableWalletFactory,
            [ ],
            {kind: "uups"});
        await wallet.deployed();
        saveXAssetValue(xAssetData, 'FarmInvestableWallet', wallet.address);
        console.log("FarmInvestableWallet deployed to:", wallet.address);
    } else {
        console.log("FarmInvestableWallet already deployed");
        wallet = FarmInvestableWalletFactory.attach(getXAssetValue(xAssetData, 'FarmInvestableWallet'));
    }

    if (resume && getXAssetValue(xAssetData, 'FarmInvestableWalletInitialised') == null) {
        let tx = await wallet.setWhitelistEnabled(true);
        await tx.wait();
        // tx = await strategy.addToWhitelist([owner.address]);
        // await tx.wait();
        let stableCoinAddresses = xAssetData.stableCoins.map((stableCoin) => stableCoin.address);
        tx = await wallet.addToTokenWhitelist(stableCoinAddresses);
        saveXAssetValue(xAssetData, 'FarmFixedRiskWalletInitialised', true);
    }

    let strategy;
    if (resume && getXAssetValue(xAssetData, 'FarmXYZStrategy') == null) {
        console.log("Deploying FarmXYZStrategy...");
        strategy = await upgrades.deployProxy(FarmXYZStrategyFactory,
            [bridge.address, wallet.address, usdcToken.address],
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
        let tx = await wallet.addToWhitelist([strategy.address]);
        await tx.wait();
        saveXAssetValue(xAssetData, 'FarmXYZStrategyWhitelisted', true);
        console.log("FarmXYZStrategy added to whitelist.");
    } else {
        console.log("FarmXYZStrategy already whitelisted");
    }

    let shareToken:XAssetShareToken;
    if (resume && getXAssetValue(xAssetData, 'XAssetShareToken') == null) {
        console.log("Deploying XAssetShareToken...");
        shareToken = await upgrades.deployProxy(XAssetShareTokenFactory,
            [xAssetData.name, xAssetData.ticker, proxyRegistryAddress],
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
            [xAssetData.ticker, usdcToken.address, shareToken.address, proxyRegistryAddress],
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
            try { let tx = await shareToken.setXAsset(xasset.address); await tx.wait(); } catch (e) { console.log("Setting XAsset on shareToken failed, moving on"); }
        }
        console.log("Strategy xasset: ", (await strategy.xAsset()).toString());
        if ((await strategy.xAsset()).toString()=='0x0000000000000000000000000000000000000000') {
            try { let tx = await strategy.setXAsset(xasset.address); await tx.wait(); } catch (e) { console.log("Setting XAsset on strategy failed, moving on"); }
        }
        try { let tx = await xasset.setStrategy(strategy.address); await tx.wait(); } catch(e) { console.log("Setting strategy on xasset failed, moving on"); }
        try { let tx = await xasset.setAcceptedPriceDifference(100); await tx.wait(); } catch(e) { console.log("Setting acceptedPriceDifference on xasset failed, moving on"); }
        let initialInvestmentSum = parseUnits("0.121", await usdcToken.decimals());
        if ((await usdcToken.balanceOf(xasset.address)).lt(initialInvestmentSum) ) {
            console.log("Transferring initial investment sum to XAssetBase...");
            let tx = await usdcToken.transfer(xasset.address, initialInvestmentSum);
            await tx.wait();
            console.log("Balance of xasset after transfer: ", (await usdcToken.balanceOf(xasset.address)).toString());
        } else {
            console.log("Initial investment sum already transferred to XAssetBase");
        }
        let tx = await xasset["executeInitialInvestment(uint256,uint256)"](initialInvestmentSum, parseUnits("1", await shareToken.decimals()));
        await tx.wait();
        saveXAssetValue(xAssetData, 'XAssetBaseSetup', true);
        console.log("XAssetBase setup complete");
    } else {
        console.log("XAssetBase already setup");
    }

    console.log("Base Token deployed to:", usdcToken.address);
    console.log("Wallet deployed to:", wallet.address);
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);
    console.log("XAssetBase deployed to:", xasset.address);
    console.log("XAsset price:", await xasset.getSharePrice());

    console.groupEnd();
}

async function main() {
    readConfig();

    console.log("Deploying to network: ", hre.network.name);

    if (hre.network.name == 'hardhat') {
        config[hre.network.name] = config['bsc'];
        stableCoins[hre.network.name] = stableCoins['bsc'];
    }

    const [ owner ] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("ERC20");
    for(let [key, token] of Object.entries(stableCoins[hre.network.name])) {
        stableCoins[hre.network.name][key].contract = ERC20Factory.attach(token.address);
    }

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
        console.log("XAssetMacros already deployed to ", getValue('XAssetMacros'));
    }

    let xAssetsData = [
        {
            name: "FARMX Seed Allocation XASSET",
            ticker: "X-FARMX-SEED",
            stableCoins: [
                stableCoins[hre.network.name]['USDC'].contract,
                stableCoins[hre.network.name]['USDT'].contract,
                stableCoins[hre.network.name]['DAI'].contract,
                stableCoins[hre.network.name]['BUSD'].contract,
            ]
        }
    ];

    for (let i = 0; i < xAssetsData.length; i++) {
        await deployFarmInvestmentXAsset(xAssetsData[i], true);
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
