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

export async function deployXAssetFarmContracts(farmXYZ: FarmXYZBase, usdToken: ERC20): Promise<{ asset: XAssetBase, strategy: FarmStrategy, bridge: FarmXYZPlatformBridge, shareToken: ERC20 }> {
  upgrades.silenceWarnings();
  const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
  const Trigonometry = await ethers.getContractFactory("Trigonometry");
  const Trig = await Trigonometry.deploy();
  const FarmStrategy = await ethers.getContractFactory("FarmStrategy", {libraries: {
    Trigonometry: Trig.address
  }});
  const XAssetBase = await ethers.getContractFactory("XAssetBase");
  const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
  // TODO: Set GSN forwarder & integrate GSN from https://github.com/opengsn/workshop

  const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], { kind: "uups" });
  await bridge.deployed();
  const strategy = await upgrades.deployProxy(FarmStrategy, [bridge.address, farmXYZ.address, usdToken.address], { kind: "uups", unsafeAllowLinkedLibraries: true });

  const shareToken = await upgrades.deployProxy(XAssetShareToken, [ "X-TFARMX XASSET Shares", "X-TFARMX" ], { kind: "uups" });
  await shareToken.deployed();

  const xassetProxy = await upgrades.deployProxy(XAssetBase, [ "X-TFAMRX", usdToken.address, shareToken.address ], { kind: "uups" });
  await xassetProxy.deployed();
  await (xassetProxy as XAssetBase).setStrategy(strategy.address);
  await shareToken.setXAsset(xassetProxy.address);

  await Promise.all([
    bridge.deployed(),
    strategy.deployed(),
    xassetProxy.deployed(),
  ]);

  return {
    asset: xassetProxy as unknown as XAssetBase,
    strategy: strategy as unknown as FarmStrategy,
    bridge: bridge as unknown as FarmXYZPlatformBridge,
    shareToken: shareToken as unknown as ERC20};
}
