// import { ethers, upgrades } from "hardhat";
// import {parseUnits} from "ethers/lib/utils";
// import {BigNumber} from "ethers";
// import {ERC20, FarmFixedRiskWallet, XAssetBase, XAssetBaseV2} from "../../typechain";
// import hre = require("hardhat");
// import {timeout} from "../../test/helpers/utils";

async function main() {
    // const [ owner ] = await ethers.getSigners();
    //
    // const oldAddress = '0x0416fD0A193b5a0BE3d26e733039A85c21B58637';
    // const XAssetBase = await ethers.getContractFactory("XAssetBase");
    // const XAssetBaseV2 = await ethers.getContractFactory("XAssetBaseV2");
    //
    //
    // console.log("Upgrading XAssetBase contract at", oldAddress);
    // const oldContract = await upgrades.forceImport(oldAddress, XAssetBase, { kind: "uups" });
    // let xassetProxy = await upgrades.upgradeProxy(oldAddress, XAssetBaseV2, {kind: "uups"});
    // console.log("XAsset Upgraded", xassetProxy.address);
    //
    // (await xassetProxy as XAssetBaseV2).setAcceptedPriceDifference(1000);
    // console.log("Accepted price difference set to 1000");
    //
    // await timeout(60000);
    //
    // console.log("Verifying up XAssetBase...");
    // await hre.run("verify:verify", {
    //     address: xassetProxy.address
    // });
    // console.log("XAssetBase verified.");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
