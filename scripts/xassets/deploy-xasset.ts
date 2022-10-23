import { ethers, upgrades } from "hardhat";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber} from "ethers";
import {ERC20, FarmFixedRiskWallet, XAssetBase} from "../../typechain";
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

async function main() {
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

    const totalRewardPool = parseUnits("3000", await usdcToken.decimals());
    const returnsPaybackPeriod = BigNumber.from(90*24*3600);

    console.log("Deploying FarmFixedRiskWallet...");
    const FarmFixedRiskWalletFactory = await ethers.getContractFactory("FarmFixedRiskWallet");
    const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWalletFactory,
        [usdcToken.address],
        {kind: "uups"});
    const farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
    await farmXYZFarm.deployed();
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
    saveValue('FarmFixedRiskWallet', farmXYZFarm.address);

    console.log("Setting up FarmFixedRiskWallet...");
    await usdcToken.approve(farmXYZFarm.address, totalRewardPool);
    await farmXYZFarm.depositToReturnsPool(totalRewardPool);
    await farmXYZFarm.setPaybackPeriod(returnsPaybackPeriod);
    await farmXYZFarm.setWhitelistEnabled(true);
    console.log("FarmFixedRiskWallet setup done.");
    saveValue('FarmFixedRiskWalletSetup', true);


    const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
    const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
    const XAssetBase = await ethers.getContractFactory("XAssetBase");
    const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");

    console.log("Deploying FarmXYZPlatformBridge...");
    const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], {kind: "uups"});
    await bridge.deployed();
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    saveValue('FarmXYZPlatformBridge', bridge.address);

    console.log("Deploying FarmXYZStrategy...");
    const strategy = await upgrades.deployProxy(FarmXYZStrategy,
        [bridge.address, farmXYZFarm.address, usdcToken.address],
        {kind: "uups"});
    await strategy.deployed();
    saveValue('FarmXYZStrategy', strategy.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);

    console.log("Adding FarmXYZStrategy to whitelist..");
    await farmXYZFarm.addToWhitelist([ strategy.address ]);
    saveValue('FarmXYZStrategyWhitelisted', true);
    console.log("FarmXYZStrategy added to whitelist.");

    console.log("Deploying XAssetShareToken...");
    const _shareToken = await upgrades.deployProxy(XAssetShareToken,
        ["X-USDC Test XASSET", "X-USDC"],
        {kind: "uups"});
    await _shareToken.deployed();
    saveValue('XAssetShareToken', _shareToken.address);
    console.log("XAssetShareToken deployed to:", _shareToken.address);
    const shareToken = _shareToken as ERC20;

    console.log("Deploying XAssetBase...");
    const _xasset = await upgrades.deployProxy(XAssetBase,
        ["X-DAI-USDC-USDT", usdcToken.address, _shareToken.address],
        {kind: "uups"});
    const xasset = _xasset as XAssetBase;
    await xasset.deployed();
    saveValue('XAssetBase', xasset.address);
    console.log("XAssetBase deployed to:", xasset.address);

    console.log("Setting up XAssetBase...");
    await _shareToken.setXAsset(xasset.address);
    await xasset.setStrategy(strategy.address);
    await usdcToken.transfer(xasset.address, parseUnits("10", await usdcToken.decimals()));
    await xasset.executeInitialInvestment();
    saveValue('XAssetBaseSetup', true);
    console.log("XAssetBase setup complete");

    // Now that all those are done let's initialize the macros contract
    console.log("Deploying XAssetMacros...");
    const XAssetMacros = await ethers.getContractFactory("XAssetMacros");
    const xassetMacros = await XAssetMacros.deploy();
    await xassetMacros.deployed();
    saveValue('XAssetMacros', xassetMacros.address);
    console.log("XAssetMacros deployed to:", xassetMacros.address);

    // await timeout(10000);
    //
    // console.log("Verifying up XAssetMacros...");
    // await hre.run("verify:verify", {
    //     address: xassetMacros.address
    // });
    // console.log("XAssetMacros verified.");
    //
    // console.log("Verifying up XAssetBase...");
    // await hre.run("verify:verify", {
    //     address: xasset.address
    // });
    // console.log("XAssetBase verified.");
    //
    // console.log("Verifying up FarmXYZStrategy...");
    // await hre.run("verify:verify", {
    //     address: strategy.address
    // });
    // console.log("FarmXYZStrategy verified.");


    console.log("USDC Token deployed to:", usdcToken.address);
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);
    console.log("FarmXYZStrategy deployed to:", strategy.address);
    console.log("XAssetBase deployed to:", xasset.address);
    console.log("XAssetMacros deployed to:", xassetMacros.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
