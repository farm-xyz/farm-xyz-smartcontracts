import {XAssetBase} from "../../typechain";

type Constructor<T> = { new (): T }

export class XAssetModel {
    id: string;
    name: string | undefined;
    change: number | undefined;
    safetyScore: number | undefined;
    realAPY: { realAPY1m: number, realAPY6m: number, realAPY3m: number } | undefined;
    icon: string | undefined;
    platform: string | undefined;
    address: string;
    chain: string | undefined;
    price: string | undefined;
    isTestNet: boolean = false;
    priceToken: { name: string, ticker: string, tokenContract: string, decimals: number, interfaceType: string, displayDecimals: number } | undefined;
    shareToken: { name: string, ticker: string, tokenContract: string, decimals: number, interfaceType: string, displayDecimals: number } | undefined;
    chart: { t:any, o: string, h: string, l: string, c: string }[] | undefined;


    constructor(id: string, address: string) {
        this.address = address;
        this.id = id;
    }

    static fromDbData<T extends XAssetModel>(this: new (id: string, address: string) => T, data: any): T {
        let ret = new this(data.id, data.address);
        ret.name = data.name;
        ret.change = data.percentage;
        ret.safetyScore = data.safetyScore;
        ret.realAPY = {
            realAPY1m: data.xassetAPY.realAPY1m,
            realAPY3m: data.xassetAPY.realAPY3m,
            realAPY6m: data.xassetAPY.realAPY6m,
        };
        ret.icon = data.media.publicUrl;
        ret.platform = data.platformName;
        ret.chain = data.blockchain.name;
        ret.price = data.price;
        ret.isTestNet = data.blockchain.isTestNet;
        ret.priceToken = data.priceToken;
        ret.shareToken = data.shareToken;
        return ret;
    }
}