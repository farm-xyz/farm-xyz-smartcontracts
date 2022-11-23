import {ethers} from "hardhat";
import {
    FarmFixedRiskWallet,
    FarmFixedRiskWallet__factory,
    TestToken__factory,
    XAssetBase,
    XAssetBase__factory
} from "../../typechain";
import axios from "axios";
import * as admin from "firebase-admin";
import {firestore} from "firebase-admin";
import moment from "moment";
import {readFileSync} from "fs";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import hre = require("hardhat");
import FirestoreDataConverter = firestore.FirestoreDataConverter;
import WriteBatch = firestore.WriteBatch;
import setLogFunction = firestore.setLogFunction;
import {XAssetModel} from "../utils/XAsset";
import {FarmXYZTools} from "../utils/FarmXYZTools";

const BASE_URL = 'https://farm-xyz.uc.r.appspot.com';

const contracts: { [key: string]: { [key: string]: string } } = {
    polygon: {
        // usdc:
    },
    mumbai: {
        usdc: "0x85111aF7Af9d768D928d8E0f893E793625C00bd1",
        farmFixedRiskWallet: "0x3A4178B10632ee928C7827E46b56ef12582EE68F",
    }
}

const TIME_BETWEEN_UPDATES = 2000;

class XAsset extends XAssetModel {
    #contract: XAssetBase | undefined;

    get contract(): XAssetBase {
        if (!this.#contract) {
            this.#contract = XAssetBaseFactory.attach(this.address);
        }
        return this.#contract;
    }

}

class Batch {
    batch: WriteBatch;
    size: number;

    constructor() {
        this.batch = db.batch();
        this.size = 0;
    }

    async set(doc: firestore.DocumentReference, data: any) {
        this.batch.set(doc, data);
        this.size++;
        if (this.size>490) {
            await this.commit();
        }
    }

    async delete(doc: firestore.DocumentReference) {
        this.batch.delete(doc);
        this.size++;
        if (this.size>490) {
            await this.commit();
        }
    }

    async commit() {
        console.log(`${this.size} updates pending, committing`);
        await this.batch.commit();
        this.batch = db.batch();
        this.size = 0;
    }
}

const xAssetFirebaseConverter: FirestoreDataConverter<XAsset> = {
    fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): XAsset {
        const data = snapshot.data()!;
        const ret = new XAsset(data.id, data.address);
        ret.name = data.name;
        ret.change = data.change;
        ret.safetyScore = data.safetyScore;
        ret.realAPY = data.realAPY;
        ret.icon = data.icon;
        ret.platform = data.platform;
        ret.chain = data.chain;
        ret.price = data.price;
        ret.isTestNet = data.isTestNet;
        ret.priceToken = data.priceToken;
        ret.shareToken = data.shareToken;
        ret.chart = data.chart;

        return ret;
    },

    toFirestore(modelObject: FirebaseFirestore.WithFieldValue<XAsset>): FirebaseFirestore.DocumentData {
        return {
            id: modelObject.id,
            name: modelObject.name,
            change: modelObject.change,
            safetyScore: modelObject.safetyScore,
            realAPY: modelObject.realAPY,
            icon: modelObject.icon,
            platform: modelObject.platform,
            address: modelObject.address,
            chain: modelObject.chain,
            price: modelObject.price,
            isTestNet: modelObject.isTestNet,
            priceToken: modelObject.priceToken,
            shareToken: modelObject.shareToken,
            chart: modelObject.chart
        };
    }
}

const intervals=[ '1m', '5m', '1h', '1d', '1w', '1mo' ];
const candleLimitPerInterval:{ [key: string]: number } = {
    '1m': 200, //60*24,
    '5m': 200, //60*24/5,
    '1h': 200,
    '1d': 200,
    '1w': 52,
    '1mo': 6
};

let firestoreXassetList: any[] = [];

let xAssetList: XAsset[] = [];

let contractInstances: { [key: string]: any } = {};

function getContract<Type>(address: string) {
    return contractInstances[address] as Type;
}

function setContract(address: string, contract: any) {
    contractInstances[address] = contract;
}

function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let app: admin.app.App;
let db: admin.firestore.Firestore;
let owner: SignerWithAddress;
let TestTokenFactory: TestToken__factory;
let FarmFixedRiskWalletFactory: FarmFixedRiskWallet__factory;
let XAssetBaseFactory: XAssetBase__factory;
let xAssetCollection: firestore.CollectionReference<XAsset>;
let xAssetCharts: { [key: string]: { [key: string]: { [key: string]: any } } } = {};

async function initialize() {
    const serviceAccount = JSON.parse(readFileSync(".firebase-admin-prod-key.json").toString());

    // setLogFunction(console.log);

    app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });


    // Initialize Cloud Firestore and get a reference to the service
    db = app.firestore();
    xAssetCollection = db.collection('xAssets').withConverter(xAssetFirebaseConverter);

    if (!contracts[hre.network.name]) {
        console.error("Current network is not supported: ", hre.network.name);
        return;
    }

    [ owner ] = await ethers.getSigners();
    TestTokenFactory = await ethers.getContractFactory("TestToken");
    FarmFixedRiskWalletFactory = await ethers.getContractFactory("FarmFixedRiskWallet");
    XAssetBaseFactory = await ethers.getContractFactory("XAssetBase");
}

async function getXAssetPriceHistory(xAsset: XAsset, interval: string, limit: number = 20):Promise<any> {
    let chartResponse = await axios.get(BASE_URL + '/api/v1/xasset-price/'+ xAsset.id +'/history',
        {
            params: {
                interval: interval,
                limit: limit
            }
        });
    if (chartResponse.data.data) {
        return chartResponse.data.data[interval];
    }
    return [];
}

async function updateXAssetFirebaseChartData(batch: Batch, xAsset: XAsset, interval: string, candles: any[]) {
    if (!xAssetCharts[xAsset.id]) {
        xAssetCharts[xAsset.id] = {};
    }
    if (!xAssetCharts[xAsset.id][interval]) {
        xAssetCharts[xAsset.id][interval] = {};
    }
    for (let candle of candles) {
        let shouldUpdate = false;
        if (xAssetCharts[xAsset.id][interval][candle.t]) {
            let existing = xAssetCharts[xAsset.id][interval][candle.t];
            let newCandle = candle;
            if (existing.o != newCandle.o ||
                existing.h != newCandle.h ||
                existing.l != newCandle.l ||
                existing.c != newCandle.c) {
                shouldUpdate = true;
            }
        } else
            shouldUpdate = true;
        if (shouldUpdate) {
            xAssetCharts[xAsset.id][interval][candle.t] = candle;
            console.log("Updating chart data for ", xAsset.id, interval, candle.t);
            await batch?.set(db.collection('charts').doc(xAsset.id).collection(interval).doc(candle.t.toString()), candle);
            // await db.collection('charts/' + xAsset.id + '/' + interval).doc(candle.t.toString()).set(candle);
        }
    }
}

async function getFirebaseChartData() {
    for (let xAsset of xAssetList) {
        if (!xAssetCharts[xAsset.id]) xAssetCharts[xAsset.id] = {};
        for (let interval of intervals) {
            let collection = db.collection('charts').doc(xAsset.id).collection(interval);
            xAssetCharts[xAsset.id][interval] = {};
            let qs = await collection.limit(20).get();
            qs.forEach(doc => {
                xAssetCharts[xAsset.id][interval][doc.id] = doc.data();
            });
        }
    }
}

async function updateXAssetList(batch: Batch) {
    let xAssetListFromFirebase: XAsset[] = [];
    let xAssetListFromDb: XAsset[] = [];

    console.log("-- Current firebase data --");
    const querySnapshot = await xAssetCollection.get();
    querySnapshot.forEach((doc) => {
        console.log(doc.id, " => ", doc.data());
        xAssetListFromFirebase.push(doc.data());
    });

    console.log("-- Current db data --");
    let xAssetsListResponse;
    try {
        xAssetsListResponse = await axios.get(BASE_URL + '/api/v1/xasset/list');
        console.log(xAssetsListResponse.data.data.items);
        for (let xAssetData of xAssetsListResponse.data.data.items) {
            let x = XAsset.fromDbData(xAssetData);
            let candles = await getXAssetPriceHistory(x, '1d');
            x.chart = candles;
            await updateXAssetFirebaseChartData(batch, x, '1d', candles);

            xAssetListFromDb.push(x);
        }
    } catch (e:any) {
        if (e && e.response !== undefined) {
            console.error("[][] Could not fetch xAssets list from backend: ", e, e.response.data);
        } else {
            console.error("[] Could not fetch xAssets list from backend: ", e);
        }
    }

    console.log("-- Merging data --");
    for(let x of xAssetListFromDb) {
        let found = false;
        let idx = -1;
        for(let f of xAssetListFromFirebase) {
            if (x.id === f.id) {
                found = true;
                idx = xAssetListFromFirebase.indexOf(f);
                break;
            }
        }
        console.log("batch set ", x.id, " => ", x);
        await batch.set(xAssetCollection.doc(x.id), x);
        // await xAssetCollection.doc(x.id).set(x);
        xAssetListFromFirebase[idx] = x;
    }

    for(let f of xAssetListFromFirebase) {
        let found = false;
        for(let x of xAssetListFromDb) {
            if (x.id === f.id) {
                found = true;
                break;
            }
        }
        if (!found) {
            console.log("Removing ", f.id);
            await batch.delete(xAssetCollection.doc(f.id));
            // await xAssetCollection.doc(f.id).delete();
        }
    }

    xAssetList = xAssetListFromDb;
    console.log("-- Merge done --");

}

let lastProcessedBlockTime = 0;
let lastXAssetSyncTime = 0;

async function main() {
    await initialize();

    // const usdcToken = await TestTokenFactory.attach( contracts[hre.network.name].usdc ) as ERC20;
    // console.log("USDC Token attached to:", usdcToken.address);
    //
    // const farmXYZFarm = await FarmFixedRiskWalletFactory.attach( contracts[hre.network.name].farmFixedRiskWallet ) as FarmFixedRiskWallet;
    //
    // console.log("FarmFixedRiskWallet attached to:", farmXYZFarm.address);

    let batch = new Batch();
    // let batch:WriteBatch|null = null;
    await updateXAssetList(batch);
    console.log("Commit xAsset list");
    await batch.commit();
    console.log("XAsset list updated");

    await getFirebaseChartData();

    // return;
    // noinspection UnreachableCodeJS
    ethers.provider.on('block', async (blockNumber) => {
        console.log("New block: ", blockNumber);
        try {
            const blockInfo = await ethers.provider.getBlock(blockNumber);
            let time = moment.unix(blockInfo.timestamp).toISOString();
            console.log(blockInfo.timestamp, time);
            if (blockInfo.timestamp - lastProcessedBlockTime < 15) {
                return;
            }
            lastProcessedBlockTime = blockInfo.timestamp;
            let batch = new Batch();
            // let batch:WriteBatch|null = null;
            if (blockInfo.timestamp - lastXAssetSyncTime > 60) {
                await updateXAssetList(batch);
                lastXAssetSyncTime = blockInfo.timestamp;
            }
            for (const xAsset of xAssetList) {
                const name = xAsset.name;
                const price = await xAsset.contract?.getSharePrice();
                console.log("Price for xAsset ", name, " at block ", blockNumber, ": ", price?.toString());
                let response = await FarmXYZTools.setXAssetPrice(BASE_URL, xAsset, time, price);
                let xAssetUpdate = XAsset.fromDbData(response.data.data.xAsset);
                let candlePromises = [];
                let promise1dCandles: Promise<any> | null = null;
                for (let interval of intervals) {
                    candlePromises.push(getXAssetPriceHistory(xAssetUpdate, interval, candleLimitPerInterval[interval]));
                    if (interval == '1d') {
                        promise1dCandles = candlePromises[candlePromises.length - 1];
                    }
                }

                candlePromises.push(promise1dCandles?.then(async candles => {
                    xAssetUpdate.chart = candles;
                    await batch.set(xAssetCollection.doc(xAssetUpdate.id), xAssetUpdate);
                    // await xAssetCollection.doc(xAssetUpdate.id).set(xAssetUpdate);
                }));
                await Promise.all(candlePromises).then(async candles => {
                    for (let i = 0; i < intervals.length; i++) {
                        console.log('Updating ', xAssetUpdate.id, ' ', intervals[i], ' candles');
                        await updateXAssetFirebaseChartData(batch, xAsset, intervals[i], candles[i]);
                    }
                }).catch(e => {
                    console.error("Error getting xAsset price history: ", e);
                });

                // console.log(xAssetUpdate);

                // console.log(response.data);
                // console.log(response.data.data.xAsset);
            }
            await batch.commit();

        } catch (e:any) {
            console.error("Error processing block: ", e);
        }
    });
}



// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
