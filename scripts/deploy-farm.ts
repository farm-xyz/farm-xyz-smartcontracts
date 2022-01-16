// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import fs from "fs";
import {FarmXYZTools} from "./utils/FarmXYZTools";

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
  const farmName = await FarmXYZTools.promptInput('What is the farm contract name?', 'FarmXYZBase.sol');
  const stakeTokenName = await FarmXYZTools.promptInput('What is the STAKE token contract name?');
  const rewardTokenName = await FarmXYZTools.promptInput('What is the REWARD token contract name?',);
  const apy = await FarmXYZTools.promptNumber('What is the farm APY?',);

  const buildPath = await FarmXYZTools.deployFarm(farmName, stakeTokenName, rewardTokenName, apy);
  console.log(`Deployed at: ${buildPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
