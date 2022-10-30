import { ethers, upgrades } from "hardhat";
import {
  FarmXYZBase,
  FarmXYZPlatformBridge,
  FarmXYZStrategy,
  RFarmXToken,
  TFarmXToken,
  XAssetBase,
  TestToken,
  ERC20,
  IXAsset,
  XAssetShareToken
} from "../../typechain";
import {setTokenBalance} from "./chain";
import {parseUnits} from "ethers/lib/utils";
import {getPRBProxy, getPRBProxyRegistry, PRBProxyRegistry} from "@prb/proxy";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {PRBProxy} from "@prb/proxy/dist/types/PRBProxy";
import hre = require("hardhat");
import {Test} from "mocha";

type BaseWalletsAndTokens = {
  usdcToken: ERC20,
  usdcTokenDecimals:number,
  registry: PRBProxyRegistry,
  owner:SignerWithAddress,
  john: SignerWithAddress,
  alice: SignerWithAddress
};


export let baseWalletsAndTokens: BaseWalletsAndTokens;
export let proxyList: { [key: string]: PRBProxy } = {};

export async function initializeBaseWalletsAndTokens():Promise<BaseWalletsAndTokens> {
  let owner, john, alice;
  [owner, john, alice] = await ethers.getSigners();

  const ERC20Factory = await ethers.getContractFactory("ERC20");

  let usdcToken:ERC20;
  let usdcTokenDecimals = 18;
  if (hre.network.name === "hardhat") {
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    const testToken = await TestTokenFactory.attach("0x85111aF7Af9d768D928d8E0f893E793625C00bd1") as TestToken;
    usdcToken = testToken;
    usdcTokenDecimals = await testToken.decimals();
    await testToken.mint(owner.address, parseUnits("100000000", usdcTokenDecimals));
    await testToken.mint(john.address, parseUnits("100000000", usdcTokenDecimals));
    await testToken.mint(alice.address, parseUnits("100000000", usdcTokenDecimals));

    /*
    usdcToken = ERC20Factory.attach("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
    usdcTokenDecimals = await usdcToken.decimals();
    await setTokenBalance("USDC", owner.address, parseUnits("102000000", usdcTokenDecimals));
    await usdcToken.connect(owner).transfer(john.address,  parseUnits("1000000", usdcTokenDecimals));
    await usdcToken.connect(owner).transfer(alice.address, parseUnits("1000000", usdcTokenDecimals));
     */
  } else if (hre.network.name == "mumbai") {
    usdcToken = await ERC20Factory.attach("0x85111aF7Af9d768D928d8E0f893E793625C00bd1") as ERC20;
    usdcTokenDecimals = await usdcToken.decimals();
    // await usdcToken.connect(owner).(owner.address, parseUnits("102000000", 6));
  } else {
    const TestTokenFactory = await ethers.getContractFactory("TestToken");
    usdcToken = await TestTokenFactory.deploy("Test USDC", "USDC") as ERC20;
  }


  // Start with PRBProxy initialization
  const registry: PRBProxyRegistry = getPRBProxyRegistry(owner);

  baseWalletsAndTokens = {usdcToken, usdcTokenDecimals, registry, owner, john, alice};
  return baseWalletsAndTokens;
}

export function setBaseWalletsAndTokens(bw: BaseWalletsAndTokens) {
    baseWalletsAndTokens = bw;
}

export function usdc(amount:string) {
  return parseUnits(amount, baseWalletsAndTokens.usdcTokenDecimals);
}

export async function getProxyForSigner(signer:SignerWithAddress) {
  if (proxyList[signer.address]) {
    return proxyList[signer.address];
  }

  const prbProxyAddress: string = await baseWalletsAndTokens.registry.connect(signer).getCurrentProxy(signer.address);
  let signerProxy = getPRBProxy(prbProxyAddress, signer);

  console.log("[proxy] owner proxy address: " + signerProxy.address);
  if (signerProxy.address == "0x0000000000000000000000000000000000000000") {
    console.log("[proxy] Deploying new proxy for owner");
    await baseWalletsAndTokens.registry.connect(signer).deploy();
    const prbProxyAddress: string = await baseWalletsAndTokens.registry.connect(signer).getCurrentProxy(signer.address);
    signerProxy = getPRBProxy(prbProxyAddress, signer);
    console.log("[proxy] new proxy created for owner: " + signerProxy.address);
  }

  let allowance = await baseWalletsAndTokens.usdcToken.connect(signer).allowance(signer.address, signerProxy.address);
  if (allowance.lt(usdc("100000000"))) {
    console.log("[proxy] Approving proxy " + signerProxy.address +" to use USDC");
    await baseWalletsAndTokens.usdcToken.connect(signer).approve(signerProxy.address, usdc("100000000"));
  }

  proxyList[signer.address] = signerProxy;

  return signerProxy;
}

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

export async function deployXAssetFarmContracts(farmXYZ: FarmXYZBase, usdToken: ERC20): Promise<{ asset: XAssetBase, strategy: FarmXYZStrategy, bridge: FarmXYZPlatformBridge, shareToken: ERC20 }> {
  upgrades.silenceWarnings();
  const FarmXYZPlatformBridge = await ethers.getContractFactory("FarmXYZPlatformBridge");
  // const Trigonometry = await ethers.getContractFactory("Trigonometry");
  // const Trig = await Trigonometry.deploy();
  // const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy", {libraries: {
  //   Trigonometry: Trig.address
  // }});
  const FarmXYZStrategy = await ethers.getContractFactory("FarmXYZStrategy");
  const XAssetBase = await ethers.getContractFactory("XAssetBase");
  const XAssetShareToken = await ethers.getContractFactory("XAssetShareToken");
  // TODO: Set GSN forwarder & integrate GSN from https://github.com/opengsn/workshop

  const bridge = await upgrades.deployProxy(FarmXYZPlatformBridge, [], { kind: "uups" });
  await bridge.deployed();
  const strategy = await upgrades.deployProxy(FarmXYZStrategy, [bridge.address, farmXYZ.address, usdToken.address], { kind: "uups" /* , unsafeAllowLinkedLibraries: true */});

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
    strategy: strategy as unknown as FarmXYZStrategy,
    bridge: bridge as unknown as FarmXYZPlatformBridge,
    shareToken: shareToken as unknown as ERC20};
}
