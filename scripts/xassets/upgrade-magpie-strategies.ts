import { ethers, upgrades } from "hardhat";
import {MagpieStrategy, MagpieStrategyV2} from "../../typechain";
import {readFileSync, writeFileSync} from "fs";


let config: { [key: string]: { [key: string]: any } } = {};

function readConfig() {
    try {
        let configJson = readFileSync('deploy-magpie.json', 'utf-8');
        config = JSON.parse(configJson);
    } catch (e) {
        config = {};
    }
}

function saveConfig() {
    let configJson = JSON.stringify(config, null, 2);
    writeFileSync('deploy-magpie.json', configJson);
}


async function main() {
    readConfig();

    const [ owner ] = await ethers.getSigners();
    const MagpieStrategyFactory = await ethers.getContractFactory("MagpieStrategy");
    const MagpieStrategyV2Factory = await ethers.getContractFactory("MagpieStrategyV2");

    for (let [xassetName, xasset] of Object.entries(config['bsc'])) {
        // check if xasset is object & has the strategy set
        if (typeof xasset == "object" && xasset['MagpieStrategy'] !== undefined) {
            // if (xasset['version'] && xasset['version'] == 2) {
            //     continue;
            // }
            // console.log('Upgrading', xassetName);
            // let oldContract;
            // oldContract = await upgrades.forceImport(xasset['MagpieStrategy'], MagpieStrategyFactory, {kind: "uups"});
            //
            // const strategy = await upgrades.upgradeProxy(oldContract, MagpieStrategyV2Factory, { kind: "uups" });
            // await strategy.deployed();
            // let tx = await strategy.setXAsset(xasset['XAssetBase']);
            // let txx = await tx.wait();
            // console.log('Upgraded', xassetName, txx.transactionHash);
            // config['bsc'][xassetName]['version'] = 2;
            // saveConfig();

            const strategy = MagpieStrategyV2Factory.attach(xasset['MagpieStrategy']);
            let totalAssetValue = await strategy.getTotalAssetValue();
            console.log(xassetName, totalAssetValue.toString());
            if (xassetName!='XAsset-X[MGP]-USDT') {
                let tx1 = await strategy.setXAsset(owner.address);
                let tx1x = await tx1.wait();
                console.log('Set xAsset to', owner.address, tx1x.transactionHash);
                let tx2 = await strategy.invest(await strategy.baseToken(), ethers.utils.parseEther('10'), 0);
                let tx2x = await tx2.wait();
                console.log('Invested', tx2x.transactionHash);
                let tx3 = await strategy.setXAsset(xasset['XAssetBase']);
                let tx3x = await tx3.wait();
                console.log('Set xAsset back', xassetName, tx3x.transactionHash);
            }
            // if (totalAssetValue.gt(ethers.utils.parseEther('10'))) {
            //     console.log('Strategy for xAsset', xassetName, 'has more then $10 in it. Skipping.');
            //     continue;
            // }
            // console.log('Strategy for xAsset', xassetName, 'has less then $10 in it. Should deposit.');
            // let tx = await strategy.setXAsset(owner.address);
        }
    }
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
