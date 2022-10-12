import { ethers, upgrades } from "hardhat";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber} from "ethers";
import {ERC20, FarmFixedRiskWallet, XAssetBase} from "../../typechain";
import hre = require("hardhat");

async function main() {
    const [ owner ] = await ethers.getSigners();

    console.log("Deploying TestUSDC...");
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    const usdcToken = await TestTokenFactory.deploy("Test: USDC Coin", "USDC");
    await usdcToken.deployed();
    console.log("TestUSDC deployed to:", usdcToken.address);

    console.log("Minting some TestUSDC...");
    await usdcToken.mint(owner.address, parseUnits("1000000000", await usdcToken.decimals()));
    // const registry: PRBProxyRegistry = getPRBProxyRegistry(owner);

    const totalRewardPool = parseUnits("1000", await usdcToken.decimals());
    const returnsPaybackPeriod = BigNumber.from(30*24*3600);

    console.log("Deploying FarmFixedRiskWallet...");
    const FarmFixedRiskWalletFactory = await ethers.getContractFactory("FarmFixedRiskWallet");
    const farmXYZFarmProxy = await upgrades.deployProxy(FarmFixedRiskWalletFactory,
        [usdcToken.address],
        {kind: "uups"});
    const farmXYZFarm = farmXYZFarmProxy as FarmFixedRiskWallet;
    await farmXYZFarm.deployed();
    console.log("FarmFixedRiskWallet deployed to:", farmXYZFarm.address);

    console.log("Setting up FarmFixedRiskWallet...");
    await usdcToken.approve(farmXYZFarm.address, totalRewardPool);
    await farmXYZFarm.depositToReturnsPool(totalRewardPool);
    await farmXYZFarm.setPaybackPeriod(returnsPaybackPeriod);
    console.log("FarmFixedRiskWallet setup done.");

    const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
    const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
    const XAssetBase = await ethers.getContractFactory("XAssetBase");
    const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");

    console.log("Deploying FarmXYZPlatformBridge...");
    const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], {kind: "uups"});
    await bridge.deployed();
    console.log("FarmXYZPlatformBridge deployed to:", bridge.address);

    console.log("Deploying FarmXYZStrategy...");
    const strategy = await upgrades.deployProxy(FarmXYZStrategy,
        [bridge.address, farmXYZFarm.address, usdcToken.address],
        {kind: "uups"});
    await strategy.deployed();
    console.log("FarmXYZStrategy deployed to:", strategy.address);

    console.log("Deploying XAssetShareToken...");
    const _shareToken = await upgrades.deployProxy(XAssetShareToken,
        ["X-USDC Test XASSET", "X-USDC"],
        {kind: "uups"});
    await _shareToken.deployed();
    console.log("XAssetShareToken deployed to:", _shareToken.address);
    const shareToken = _shareToken as ERC20;

    console.log("Deploying XAssetBase...");
    const _xasset = await upgrades.deployProxy(XAssetBase,
        ["X-DAI-USDC-USDT", usdcToken.address, _shareToken.address],
        {kind: "uups"});
    const xasset = _xasset as XAssetBase;
    await xasset.deployed();
    console.log("XAssetBase deployed to:", xasset.address);

    console.log("Setting up XAssetBase...");
    await _shareToken.setXAsset(xasset.address);
    await xasset.setStrategy(strategy.address);
    await usdcToken.transfer(xasset.address, parseUnits("10", await usdcToken.decimals()));
    await xasset.executeInitialInvestment();
    console.log("XAssetBase setup complete");

    // Now that all those are done let's initialize the macros contract
    console.log("Deploying XAssetMacros...");
    const XAssetMacros = await ethers.getContractFactory("XAssetMacros");
    const xassetMacros = await XAssetMacros.deploy();
    await xassetMacros.deployed();
    console.log("XAssetMacros deployed to:", xassetMacros.address);


    console.log("Verifying up XAssetMacros...");
    await hre.run("verify:verify", {
        address: xassetMacros.address
    });
    console.log("XAssetMacros verified.");

    console.log("Verifying up XAssetBase...");
    await hre.run("verify:verify", {
        address: xasset.address
    });
    console.log("XAssetBase verified.");

    console.log("Verifying up FarmXYZStrategy...");
    await hre.run("verify:verify", {
        address: strategy.address
    });
    console.log("FarmXYZStrategy verified.");


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
