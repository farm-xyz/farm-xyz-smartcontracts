// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import fs from "fs";
import {ethers} from "hardhat";

const Confirm = require('prompt-confirm');

function getRewardToken(rewardTokenName: string): Required<{ address: string }> {
  const rewardFilePath = process.cwd() + `/build/contracts/${rewardTokenName}.json`;
  if (!fs.existsSync(rewardFilePath)) {
    throw new Error(`The reward token is NOT deployed at: ${rewardFilePath}`);
  }

  return JSON.parse(fs.readFileSync(rewardFilePath).toString());
}

function getStakeToken(stakeTokenName: string): Required<{ address: string }> {
  const stakeFilePath = process.cwd() + `/build/contracts/${stakeTokenName}.json`;
  if (!fs.existsSync(stakeFilePath)) {
    throw new Error(`The reward token is NOT deployed at: ${stakeFilePath}`);
  }

  return JSON.parse(fs.readFileSync(stakeFilePath).toString());
}

function getFarmBuildPath(name: string, rewardTokenName: string, stakeTokenName: string, apy: number): string {
  const sourcePath = process.cwd() + `/contracts/${name}.sol`;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`The token is expected to have a contract defined in "/contracts" dir, named ${name}.sol`);
  }

  if (rewardTokenName.indexOf('Token') > 0) {
    rewardTokenName = rewardTokenName.substring(0, rewardTokenName.indexOf('Token'));
  }
  if (stakeTokenName.indexOf('Token') > 0) {
    stakeTokenName = stakeTokenName.substring(0, stakeTokenName.indexOf('Token'));
  }
  const buildPath = process.cwd() + `/build/contracts/${name}_${rewardTokenName}_${stakeTokenName}_${apy}.json`;
  if (fs.existsSync(buildPath)) {
    throw new Error(`The token is already deployed at: ${buildPath}`);
  }

  return buildPath;
}

function parseArguments(): { farmName: string, rewardTokenName: string, stakeTokenName: string, apy: number } {
  if (!process.env.ROPSTEN_PRIVATE_KEY) {
    throw new Error(`Expected ROPSTEN_PRIVATE_KEY to be defined in .env`);
  }
  if (!process.env.ROPSTEN_ALCHEMY_API_KEY) {
    throw new Error(`Expected ROPSTEN_ALCHEMY_API_KEY to be defined in .env`);
  }

  const farmName = process.env.DEPLOY_FARM_NAME;
  if (!farmName) {
    throw new Error(`Expected DEPLOY_FARM_NAME to be defined in .env`);
  }
  const rewardTokenName = process.env.DEPLOY_FARM_REWARD_TOKEN;
  if (!rewardTokenName) {
    throw new Error("Expected DEPLOY_FARM_REWARD_TOKEN to be defined in .env");
  }
  const stakeTokenName = process.env.DEPLOY_FARM_STAKE_TOKEN;
  if (!stakeTokenName) {
    throw new Error("Expected DEPLOY_FARM_STAKE_TOKEN to be defined in .env");
  }
  const apy = process.env.DEPLOY_FARM_APY;
  if (!apy) {
    throw new Error("Expected DEPLOY_FARM_APY to be defined in .env");
  }
  if (parseInt(apy) <= 0) {
    throw new Error("Farm cannot have negative APY");
  }

  return {farmName, rewardTokenName, stakeTokenName, apy: parseInt(apy)};
}

async function main() {
  const {farmName, rewardTokenName, stakeTokenName, apy} = parseArguments();
  console.log('Arguments:', farmName, rewardTokenName, stakeTokenName, apy, `Ropesten: ${process.env.ROPSTEN_PRIVATE_KEY}`, `Alchemy: ${process.env.ROPSTEN_ALCHEMY_API_KEY}`);

  const farmBuildPath = getFarmBuildPath(farmName, rewardTokenName, stakeTokenName, apy);
  const rewardToken = getRewardToken(rewardTokenName);
  const stakeToken = getStakeToken(stakeTokenName);
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const confirmation = new Confirm(`Deploy farm with arguments: RewardToken: ${rewardToken.address}, StakeToken: ${stakeToken.address}, APY: ${apy}?`);
  const response = await confirmation.run();
  if (response !== true) {
    throw new Error('Deployment not confirmed!');
  }
  console.log("Deploying farm with arguments", rewardToken.address, stakeToken.address, apy);

  const factory = await ethers.getContractFactory(farmName);

  const farm = await factory.deploy(rewardToken.address, stakeToken.address, apy);
  console.log("Farm deployed at address:", farm.address);

  fs.writeFileSync(farmBuildPath, JSON.stringify(farm));

  console.log("Farm data saved at:", farmBuildPath);
  console.log("Account balance:", (await deployer.getBalance()).toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
