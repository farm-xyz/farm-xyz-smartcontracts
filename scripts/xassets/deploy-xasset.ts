import { ethers, upgrades } from "hardhat";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber, BigNumberish} from "ethers";
import {ERC20, FarmConfigSet, FarmFixedRiskWallet, XAssetBase} from "../../typechain";
import hre = require("hardhat");
import {timeout} from "../../test/helpers/utils";
import {getPRBProxyRegistry, PRBProxyRegistry} from "@prb/proxy";
import fs, {readFileSync} from "fs";

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
    if (hre.network.name=== 'hardhat') return;
    let configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync('deploy.json', configJson);
}

function saveValue(key:string, value:any) {
    if (!config[hre.network.name]) config[hre.network.name] = {};
    config[hre.network.name][key]=value;
    saveConfig();
}

function unsetConfigKeys(keys:string[]) {
    for (let i = 0; i < keys.length; i++) {
        if (config[hre.network.name])
            delete config[hre.network.name][keys[i]];
    }
    saveConfig();
}

async function deployXAsset(xAssetData: { name: string, ticker: string, rewardPool: BigNumberish, returnsPeriod: BigNumberish },
                            usdcToken: ERC20,
                            farmXYZConfigSet: FarmConfigSet,
                            resume: boolean = false) {
    if (!resume)
        unsetConfigKeys(['latest_ticker', 'latest_FarmFixedRiskWallet', 'latest_FarmFixedRiskWalletSetup',
                            'latest_FarmXYZPlatformBridge', 'latest_FarmXYZStrategy', 'latest_FarmXYZStrategyWhitelisted',
                            'latest_XAssetShareToken', 'latest_XAssetBase', 'latest_XAssetBaseSetup']);
    saveValue('latest_ticker', xAssetData.ticker);

    console.log("Deploying FarmFixedRiskWallet...");
    const FarmFixedRiskWalletFactory = await ethers.getContractFactory("FarmFixedRiskWallet");
    const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWalletFactory,
        [usdcToken.address, farmXYZConfigSet.address],
        {kind: "uups"});
    const farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
    await farmXYZFarm.deployed();
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
    saveValue('latest_FarmFixedRiskWallet', farmXYZFarm.address);

    console.log("Setting up FarmFixedRiskWallet...");
    await usdcToken.approve(farmXYZFarm.address, xAssetData.rewardPool);
    await farmXYZFarm.depositToReturnsPool(xAssetData.rewardPool);
    await farmXYZConfigSet.loadConfigs([ { farm: farmXYZFarm.address, returnsPeriod: xAssetData.returnsPeriod } ]);
    await farmXYZFarm.setWhitelistEnabled(true);
    console.log("FarmFixedRiskWallet setup done.");
    saveValue('latest_FarmFixedRiskWalletSetup', true);


    const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
    const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
    const XAssetBase = await ethers.getContractFactory("XAssetBase");
    const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");

    console.log("Deploying FarmXYZPlatformBridge...");
    const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], {kind: "uups"});
    await bridge.deployed();
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    saveValue('latest_FarmXYZPlatformBridge', bridge.address);

    console.log("Deploying FarmXYZStrategy...");
    const strategy = await upgrades.deployProxy(FarmXYZStrategy,
        [bridge.address, farmXYZFarm.address, usdcToken.address],
        {kind: "uups"});
    await strategy.deployed();
    saveValue('latest_FarmXYZStrategy', strategy.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);

    console.log("Adding FarmXYZStrategy to whitelist..");
    await farmXYZFarm.addToWhitelist([ strategy.address ]);
    saveValue('latest_FarmXYZStrategyWhitelisted', true);
    console.log("FarmXYZStrategy added to whitelist.");

    console.log("Deploying XAssetShareToken...");
    const _shareToken = await upgrades.deployProxy(XAssetShareToken,
        [xAssetData.name, xAssetData.ticker],
        {kind: "uups"});
    await _shareToken.deployed();
    saveValue('latest_XAssetShareToken', _shareToken.address);
    console.log("XAssetShareToken deployed to:", _shareToken.address);
    const shareToken = _shareToken as ERC20;

    console.log("Deploying XAssetBase...");
    const _xasset = await upgrades.deployProxy(XAssetBase,
        [xAssetData.ticker, usdcToken.address, _shareToken.address],
        {kind: "uups"});
    const xasset = _xasset as XAssetBase;
    await xasset.deployed();
    saveValue('latest_XAssetBase', xasset.address);
    console.log("XAssetBase deployed to:", xasset.address);

    console.log("Setting up XAssetBase...");
    await _shareToken.setXAsset(xasset.address);
    await xasset.setStrategy(strategy.address);
    await usdcToken.transfer(xasset.address, parseUnits("10", await usdcToken.decimals()));
    await xasset.executeInitialInvestment();
    saveValue('latest_XAssetBaseSetup', true);
    console.log("XAssetBase setup complete");

    saveValue('XAsset-'+xasset.address, {
        'FarmConfigSet': farmXYZConfigSet.address,
        'FarmFixedRiskWallet': farmXYZFarm.address,
        'FarmXYZPlatformBridge': bridge.address,
        'FarmXYZStrategy': strategy.address,
        'XAssetBase': xasset.address,
        'XAssetShareToken': shareToken.address,
    });

    console.log("USDC Token deployed to:", usdcToken.address);
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);
    console.log("XAssetBase deployed to:", xasset.address);
}

async function main() {
    readConfig();

    const [ owner ] = await ethers.getSigners();

    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    let usdcToken;
    if (hre.network.name == "mumbai") {
        usdcToken = await TestTokenFactory.attach("0x85111aF7Af9d768D928d8E0f893E793625C00bd1") as ERC20;
    } else {
        console.log("Deploying TestUSDC...");
        usdcToken = await TestTokenFactory.deploy("Test: USDC Coin", "USDC");
        await usdcToken.deployed();
        console.log("TestUSDC deployed to:", usdcToken.address);

        console.log("Minting some TestUSDC...");
        await usdcToken.mint(owner.address, parseUnits("1000000000", await usdcToken.decimals()));
    }

    saveValue('USDCToken', usdcToken.address);

    // Now that all those are done let's initialize the macros contract
    console.log("Deploying XAssetMacros...");
    const XAssetMacros = await ethers.getContractFactory("XAssetMacros");
    const xassetMacros = await XAssetMacros.deploy();
    await xassetMacros.deployed();
    saveValue('XAssetMacros', xassetMacros.address);
    console.log("XAssetMacros deployed to:", xassetMacros.address);

    const FarmConfigSetFactory = await ethers.getContractFactory("FarmConfigSet");
    const farmXYZConfigSetProxy = await upgrades.deployProxy(FarmConfigSetFactory,
        [],
        {kind: "uups"});
    let farmXYZConfigSet = farmXYZConfigSetProxy as FarmConfigSet;
    await farmXYZConfigSet.deployed();
    saveValue('FarmConfigSet', farmXYZConfigSet.address);
    console.log("FarmConfigSet deployed to:", farmXYZConfigSet.address);

    let xAssetsData = [
        {
            name: "X-USDC Test XAsset 1",
            ticker: "X-USDC-1",
            rewardPool: parseUnits("300", await usdcToken.decimals()),
            returnsPeriod: BigNumber.from(62*24*3600)
        },
        {
            name: "X-USDC Test XAsset 2",
            ticker: "X-USDC-2",
            rewardPool: parseUnits("200", await usdcToken.decimals()),
            returnsPeriod: BigNumber.from(65*24*3600)
        },
        {
            name: "X-USDC Test XAsset 3",
            ticker: "X-USDC-3",
            rewardPool: parseUnits("400", await usdcToken.decimals()),
            returnsPeriod: BigNumber.from(51*24*3600)
        }
    ];

    for (let i = 0; i < xAssetsData.length; i++) {
        await deployXAsset(xAssetsData[i], usdcToken, farmXYZConfigSet);
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
