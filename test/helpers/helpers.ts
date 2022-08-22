import { ethers, upgrades } from "hardhat";
import {
  FarmXYZBase,
  FarmXYZPlatformBridge,
  FarmStrategy,
  RFarmXToken,
  TFarmXToken,
  XAssetBase,
  TestToken,
  ERC20,
  IXAsset,
  XAssetShareToken
} from "../../typechain";
import {Contract} from "ethers";

export async function deployFarmXYZTestContracts(_apy: number): Promise<{ rewardToken: RFarmXToken, stakeToken: TFarmXToken, farmXYZFarm: FarmXYZBase, usdToken: ERC20 }> {
  const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
  const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
  const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");
  const USDToken = await ethers.getContractFactory("TestToken");

  const usdToken = await USDToken.deploy("USD", "USDT");
  const rewardToken = await RFarmXToken.deploy();
  const stakeToken = await TFarmXToken.deploy();
  const farmXYZFarm = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);

  await Promise.all([
    rewardToken.deployed(),
    stakeToken.deployed(),
    farmXYZFarm.deployed(),
    usdToken.deployed(),
  ]);

  return {rewardToken, stakeToken, farmXYZFarm, usdToken};
}

export async function deployXAssetFarmContracts(farmXYZ: FarmXYZBase, usdToken: ERC20): Promise<{ asset: Contract, strategy: FarmStrategy, bridge: FarmXYZPlatformBridge, shareToken: Contract }> {
  const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
  const FarmStrategy = await ethers.getContractFactory("FarmStrategy");
  const XAssetBase = await ethers.getContractFactory("XAssetBase");
  const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
  // TODO: Set GSN forwarder & integrate GSN from https://github.com/opengsn/workshop

  const bridge = await FarmXYZPlatformBridge.deploy(farmXYZ.address);
  const strategy = await FarmStrategy.deploy(bridge.address, farmXYZ.address, usdToken.address);
  // @ts-ignore
  const shareToken = await upgrades.deployProxy(XAssetShareToken, [ "X-TRARMX XASSET Shares", "X-TFARMX" ]);
  await shareToken.deployed();

  const xassetProxy = await upgrades.deployProxy(XAssetBase, [ "X-TFAMRX", usdToken.address, shareToken.address ]);
  await xassetProxy.deployed();
  await (xassetProxy as XAssetBase).setStrategy(strategy.address);

  await Promise.all([
    bridge.deployed(),
    strategy.deployed(),
    xassetProxy.deployed(),
  ]);

  return {asset: xassetProxy, strategy, bridge, shareToken};
}
