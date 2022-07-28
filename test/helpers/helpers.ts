import { ethers } from "hardhat";
import { FarmXYZBase, FarmXYZBridge, FarmXYZStrategy, RFarmXToken, TFarmXToken, XAssetBase } from "../../typechain";

export async function deployFarmXYZContract(_apy: number): Promise<{ rewardToken: RFarmXToken, stakeToken: TFarmXToken, farmXYZ: FarmXYZBase }> {
  const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
  const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
  const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");

  const rewardToken = await RFarmXToken.deploy();
  const stakeToken = await TFarmXToken.deploy();
  const farmXYZ = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);

  await Promise.all([
    rewardToken.deployed(),
    stakeToken.deployed(),
    farmXYZ.deployed(),
  ]);

  return {rewardToken, stakeToken, farmXYZ};
}

export async function deployXAssetFarmContracts(farmXYZ: FarmXYZBase): Promise<{ asset: XAssetBase, strategy: FarmXYZStrategy, bridge: FarmXYZBridge }> {
  const FarmXYZBridge = await ethers.getContractFactory("FarmXYZBridge");
  const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
  const XAssetBase = await ethers.getContractFactory("XAssetBase");

  const bridge = await FarmXYZBridge.deploy(farmXYZ.address);
  const strategy = await FarmXYZStrategy.deploy(bridge.address);
  const asset = await XAssetBase.deploy(strategy.address);

  await Promise.all([
    bridge.deployed(),
    strategy.deployed(),
    asset.deployed(),
  ]);

  return {asset, strategy, bridge};
}
