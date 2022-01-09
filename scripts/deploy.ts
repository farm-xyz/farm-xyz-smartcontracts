// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import {ethers} from "hardhat";
import {ContractFactory} from "ethers";
import {TFarmXToken} from "../typechain";
import * as fs from "fs";

async function deployRewardToken() {
  const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
  const rewardToken = await RFarmXToken.deploy();

  console.log("RewardToken:", rewardToken.address);
  // await hardhatRun("verify:verify", {
  //   address: rewardToken.address,
  //   constructorArguments: [],
  // });

  fs.writeFileSync(process.cwd() + '/build/contracts/RFarmXToken.json', JSON.stringify(rewardToken));

  return rewardToken;
}

async function deployStakeToken() {
  const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
  const stakeToken = await TFarmXToken.deploy();

  console.log("StakeToken:", stakeToken.address);
  // await hardhatRun("verify:verify", {
  //   address: stakeToken.address,
  //   constructorArguments: [],
  // });

  fs.writeFileSync(process.cwd() + '/build/contracts/TFarmXToken.json', JSON.stringify(stakeToken));

  return stakeToken;
}

async function deployFarm(factory: ContractFactory, stakeTokenAddress: string, rewardTokenAddress: string, _apy: number) {
  const farmXYZ = await factory.deploy(stakeTokenAddress, rewardTokenAddress, _apy);
  console.log("FarmXYZ:", farmXYZ.address, {_apy});

  // await hardhatRun("verify:verify", {
  //   address: farmXYZ.address,
  //   constructorArguments: [stakeTokenAddress, rewardTokenAddress, _apy],
  // });

  fs.writeFileSync(process.cwd() + `/build/contracts/FarmXYZ_${_apy}.json`, JSON.stringify(farmXYZ));

  return farmXYZ;
}

async function main() {
  const rewardFilePath = process.cwd() + '/build/contracts/RFarmXToken.json';
  const stakeFilePath = process.cwd() + '/build/contracts/TFarmXToken.json';
  let rewardToken, stakeToken;
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("ENV", process.env.ROPSTEN_PRIVATE_KEY, process.env.ROPSTEN_ALCHEMY_API_KEY);

  if (fs.existsSync(rewardFilePath)) {
    rewardToken = JSON.parse(fs.readFileSync(rewardFilePath).toString());
    console.log('CacheRewardToken', rewardToken.address);
  } else {
    // rewardToken = await deployRewardToken();
  }
  console.log("Account balance:", (await deployer.getBalance()).toString());
  if (fs.existsSync(stakeFilePath)) {
    stakeToken = JSON.parse(fs.readFileSync(stakeFilePath).toString());
    console.log('CacheStakeToken', stakeToken.address);
  } else {
    // stakeToken = await deployStakeToken();
  }

  console.log("Account balance:", (await deployer.getBalance()).toString());
  if (!(stakeToken.address && rewardToken.address)) {
    throw new Error("Invalid farm tokens!");
  }

  const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");

  // await deployFarm(FarmXYZBase, stakeToken.address, rewardToken.address, 50);
  // console.log("Account balance:", (await deployer.getBalance()).toString());
  // await deployFarm(FarmXYZBase, stakeToken.address, rewardToken.address, 70);
  // console.log("Account balance:", (await deployer.getBalance()).toString());
  await deployFarm(FarmXYZBase, stakeToken.address, rewardToken.address, 120);
  console.log("Account balance:", (await deployer.getBalance()).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
