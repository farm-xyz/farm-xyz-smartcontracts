import { ethers, upgrades } from "hardhat";
import {BigNumber, BigNumberish} from "ethers";
import {XAssetModel} from "../utils/XAsset";
import {FarmXYZTools} from "../utils/FarmXYZTools";
import fs, {readFileSync} from "fs";


const BASE_URL = 'https://farm-xyz-backend.master.d.com.ro';

const DAY_START = 19294;

const farmConfigSetAddress = '0x0F61636205F38df2C038b73e5AE4F2BdfE7334b2';

let randomDataGeneratorCyclesConfig = [
    { length: 4, variance: 10, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 60, variance: 5, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 5*60, variance: 40, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 60*60, variance: 30, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 24*60*60, variance: 50, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 7*24*60*4, variance: 10, noise: 1, trend: 0, phase: 0, increment: 0},
    { length: 31*24*60*4, variance: 80, noise: 2, trend: 0, phase: 0, increment: 0},
    { length: 365*24*60*4, variance: 70, noise: 10, trend: 0, phase: 0, increment: 0},
    // { length: 700*24*60*4, variance: 2, noise: 0, trend: 100, phase: 0, increment: 0}
];


let xAssetConfigs:{ [key: string] : {
        farmAddress: string,
        targetReturnPercentage: number,
        priceModifiers: number[],
    } } = {
    '0xA4DAB08d963eaa5011FEA3a34f91066401C9FBb7': {
        farmAddress: '0x8f27AfAa99475E6D9622883d420010cD399fd289',
        targetReturnPercentage: 5.3,
        priceModifiers: []
    },
    '0x96Dc31182A70006F32e3abb7e85242CDe25ca7Ec': {
        farmAddress: '0x5E4Ab66973208db6de170B86ceBAc49B355f3BFd',
        targetReturnPercentage: 6.2,
        priceModifiers: []
    },
    '0xf4a4859C88aC69f68021F1B5467Fd43861D1065F': {
        farmAddress: '0x2dCC5f2Ca5A9da42f5e4C031423f7DA268AD86de',
        targetReturnPercentage: 3.4,
        priceModifiers: []
    },
    '0x89f381a066707E564ef8947869816E8b7939642a': {
        farmAddress: '0xaa215D92920C4FBB4187F32f907212D19b68bcDc',
        targetReturnPercentage: 8.1,
        priceModifiers: []
    },
    '0x056434C0e4779FA92ad951b8549b93D9E8FeAF30': {
        farmAddress: '0x0Fd8eff3e24128C89B94dEb53Cd0Fa34Ee57C81c',
        targetReturnPercentage: 7.2,
        priceModifiers: []
    },
};


function generateOrLoadXassetData(xAsset:string, loadDiskData:boolean) {
    if (!loadDiskData || !fs.existsSync(`xasset-${xAsset}.json`)) {
        console.time("random data generation");
        xAssetConfigs[xAsset].priceModifiers = FarmXYZTools.getRandomData(
            6 * 31 * 24 * 60 * 60 * 4,
               100, 70, 130,
               [...randomDataGeneratorCyclesConfig], true);
        console.timeEnd("random data generation");
        // save to disk
        fs.writeFileSync(`xasset-${xAsset}.json`, JSON.stringify(xAssetConfigs[xAsset].priceModifiers));
    } else {
        // load from disk
        console.time("random data load");
        xAssetConfigs[xAsset].priceModifiers = JSON.parse(fs.readFileSync(`xasset-${xAsset}.json`, 'utf8'));
        console.timeEnd("random data load");
    }
}

let xAssetList:XAssetModel[] = [];

async function main() {
    const [ owner ] = await ethers.getSigners();

    const loadDiskData = true;

    xAssetList = await FarmXYZTools.readXAssets(BASE_URL);

    const XAssetBaseFactory = await ethers.getContractFactory("XAssetBase");
    const FarmConfigSetFactory = await ethers.getContractFactory("FarmConfigSet");

    let startDate = new Date("2022-04-30T00:00:00Z");
    let endDate = new Date("2022-10-31T00:00:00Z");
    let totalSeconds = (endDate.getTime() - startDate.getTime()) / 1000;
    let targetPrices: { [key: string]: BigNumber } = {};
    for (let xAsset of xAssetList) {
        targetPrices[xAsset.address] = await XAssetBaseFactory.attach(xAsset.address).getSharePrice();
    }
    let startPrices: { [key: string]: BigNumber } = {};
    for (let xAsset of xAssetList) {
        let percentageChange = xAssetConfigs[xAsset.address].targetReturnPercentage * totalSeconds / (365 * 24 * 60 * 60);
        startPrices[xAsset.address] = targetPrices[xAsset.address].mul(1000000 - Math.floor(percentageChange * 10000)).div(1000000);
    }
    console.log(targetPrices, startPrices);


    let lastPrice = { ...startPrices };
    for (let xAsset of xAssetList) {
        console.time("Price generation for " + xAsset.address);
        let fp = fs.openSync(`xasset-prices-${xAsset.address}.csv`, 'w');
        fs.writeSync(fp, `xAsset,time,price\n`);
        generateOrLoadXassetData(xAsset.address, loadDiskData);
        let totalPriceModifiers = xAssetConfigs[xAsset.address].priceModifiers.length;
        for(let t=0;t<totalSeconds; t+=15) {
            let percentageChange = xAssetConfigs[xAsset.address].targetReturnPercentage * t / (365 * 24 * 60 * 60);
            let price = startPrices[xAsset.address].mul(1000000 - Math.floor(percentageChange * 10000)).div(1000000);
            let priceModifierIndex = Math.floor(t * totalPriceModifiers / totalSeconds);
            let priceModifier = xAssetConfigs[xAsset.address].priceModifiers[priceModifierIndex];
            price = price.mul(priceModifier).div(100);
            /*
            let diff = priceModifier - 100;
            // diff should be tending towards 0 as t increases
            let diffPercentage = Math.round(100 + ((totalSeconds - t) * diff * 0.8 / totalSeconds));
            // apply diffPercentage out of 100 to price
            price = price.mul(diffPercentage).div(100);
             */
            lastPrice[xAsset.address] = price;
            // time should be formatted as standard ISO 8601
            let time = new Date(startDate.getTime() + t * 1000).toISOString();
            fs.writeSync(fp, `${xAsset.address},${time},${price.toString()}\n`);
        }
        xAssetConfigs[xAsset.address].priceModifiers=[];
        fs.closeSync(fp);
        console.timeEnd("Price generation for " + xAsset.address);
    }

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().then(() => process.exit(0));


//     .catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });
