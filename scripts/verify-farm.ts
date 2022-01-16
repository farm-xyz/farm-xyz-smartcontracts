import fs from "fs";
import {execSync} from "child_process";

const {Input} = require('enquirer');

function getContractPath(filename: string): string {
  return process.cwd() + `/build/contracts/${filename}`;
}

function readContractFile(filename: string): { address: string } {
  const path = getContractPath(filename);
  if (!fs.existsSync(path)) {
    throw new Error(`Expected contract build at path: ${filename}`);
  }

  return JSON.parse(fs.readFileSync(path).toString())
}

async function parseArgumentsFromFarmFilename(filename: string): Promise<{ farmName: string, farm: { address: string }, stakeContract: { address: string }, rewardContract: { address: string }, apy: number }> {
  const [farmName, stakeTokenName, rewardTokenName, apy] = filename.substring(0, filename.indexOf('.json')).split('_');

  const farm = readContractFile(filename);
  const stakeContract = readContractFile(stakeTokenName + "Token.json");
  const rewardContract = readContractFile(rewardTokenName + "Token.json");

  return {
    farmName,
    farm: {
      address: farm.address
    },
    stakeContract: {
      address: stakeContract.address
    },
    rewardContract: {
      address: rewardContract.address
    },
    apy: parseInt(apy)
  };
}

async function main(farmContractFilename: string | undefined) {
  if (!farmContractFilename) {
    farmContractFilename = await (new Input({
      type: 'input',
      name: 'farmContractFilename',
      message: 'What is deployed farm contract filename?',
      skip: false,
      validate: (value: any) => typeof value === 'string' && fs.existsSync(getContractPath(value))
    })).run();
  }

  if (typeof farmContractFilename !== 'string') {
    throw new Error(`Invalid farm contract filename: ${farmContractFilename}`);
  }
  const {farmName, farm, stakeContract, rewardContract, apy} = await parseArgumentsFromFarmFilename(farmContractFilename);
  console.log('args', {farmName, farm, stakeContract, rewardContract, apy});

  const cmd = `npx hardhat verify --network ropsten --contract contracts/${farmName}.sol:${farmName} ${farm.address} ${stakeContract.address} ${rewardContract.address} ${apy}`;
  console.log(`Execute command: ${cmd}`);

  const output = execSync(cmd);
  console.log(`output: ${output}`);
}

main(process.argv[2])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
