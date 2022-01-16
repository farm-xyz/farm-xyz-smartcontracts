import fs from "fs";
import {ethers} from "hardhat";

const {BooleanPrompt, Input, NumberPrompt} = require('enquirer');
const Confirm = require('prompt-confirm');

export namespace FarmXYZTools {

  export type FarmXYZContract = { address: string };

  export function readContractBuildFile(filename: string): FarmXYZContract {
    const path = getContractBuildPath(filename);
    console.log('readContractBuildFile', path);
    if (!fs.existsSync(path)) {
      throw new Error(`Expected contract build at path: ${path}`);
    }

    return JSON.parse(fs.readFileSync(path).toString());
  }

  export function contractBuildExists(filename: string): boolean {
    return fs.existsSync(getContractBuildPath(filename));
  }

  export function saveContractBuildFile(filename: string, data: object): string {
    const path = getContractBuildPath(filename);

    fs.writeFileSync(path, JSON.stringify(data));

    return path;
  }

  export function contractDefinitionExists(filename: string): boolean {
    return fs.existsSync(getContractDefinitionPath(filename));
  }

  export async function deployToken(filename: string): Promise<string> {
    if (!contractDefinitionExists(filename)) {
      throw new Error(`Token ${filename} does not exists in "contracts" dir.`);
    }

    return await deployContract(filename);
  }

  export async function deployFarm(farmName: string, stakeTokenName: string, rewardTokenName: string, apy: number): Promise<string> {
    if (!contractDefinitionExists(farmName)) {
      throw new Error(`Contract ${farmName} is not defined`);
    }
    if (!contractDefinitionExists(stakeTokenName)) {
      throw new Error(`Contract ${farmName} is not defined`);
    }
    if (!contractDefinitionExists(rewardTokenName)) {
      throw new Error(`Contract ${farmName} is not defined`);
    }
    if (apy <= 0) {
      throw new Error(`APY MUST be greater than 0.`);
    }

    const farmBuildFilename = generateFarmBuildFilename(farmName, stakeTokenName, rewardTokenName, apy);
    if (contractBuildExists(farmBuildFilename)) {
      throw new Error(`Contract ${farmName} is already deployed`);
    }

    const stakeToken = readContractBuildFile(stakeTokenName);
    const rewardToken = readContractBuildFile(rewardTokenName);

    return await deployContract(farmName.replace(/.sol$/g, ''), stakeToken.address, rewardToken.address, apy);
  }

  export async function promptInput(message: string, defaultValue?: string | null, validateFcn?: (value: any) => boolean) {
    const input = new Input({
      type: 'input',
      name: 'name',
      initial: defaultValue,
      message,
      validate: (value: any) => typeof value === 'string' && (validateFcn ? validateFcn(value) : true)
    });

    return await input.run();
  }

  export async function promptNumber(message: string, defaultValue?: number | null, validateFcn?: (value: any) => boolean) {
    const input = new NumberPrompt({
      type: 'input',
      name: 'name',
      initial: defaultValue,
      message,
      validate: validateFcn
    });

    return await input.run();
  }

  export async function promptBoolean(message: string, defaultValue: boolean, validateFcn?: (value: any) => boolean) {
    const input = new BooleanPrompt({
      type: 'input',
      name: 'name',
      initial: defaultValue,
      message,
      validate: validateFcn
    });

    return await input.run();
  }

  export async function promptConfirmation(question: string, expectedResponse: boolean) {
    const confirmation = new Confirm(question);
    const response = await confirmation.run();

    if (response !== expectedResponse) {
      throw new Error('Action not confirmed!');
    }
  }

  function getContractBuildPath(filename: string): string {
    if (filename.indexOf('.sol') > 0) {
      filename = filename.substring(0, filename.indexOf('.sol')) + ".json";
    }

    return process.cwd() + `/build/contracts/${filename}`;
  }

  function getContractDefinitionPath(filename: string): string {
    if (filename.indexOf('.json') > 0) {
      filename = filename.substring(0, filename.indexOf('.json')) + ".sol";
    }

    return process.cwd() + `/contracts/${filename}`;
  }

  function generateFarmBuildFilename(farmFilename: string, stakeTokenFilename: string, rewardTokenFilename: string, apy: number): string {
    console.log('generateFarmBuildFilename', farmFilename, stakeTokenFilename, rewardTokenFilename, apy);

    farmFilename = farmFilename.replace(/(Base.sol|.sol)$/g, '');
    stakeTokenFilename = stakeTokenFilename.replace(/(Token.sol|.sol)$/g, '');
    rewardTokenFilename = rewardTokenFilename.replace(/(Token.sol|.sol)$/g, '');
    console.log('generateFarmBuildFilename', farmFilename, stakeTokenFilename, rewardTokenFilename, apy);

    return `${farmFilename}_${stakeTokenFilename}_${rewardTokenFilename}_${apy}.json`;
  }

  async function deployContract(filename: string, ...contractArgs: any[]): Promise<string> {
    await promptConfirmation(`Deploy contract ${filename} with arguments: ${contractArgs}?`, true);

    const [deployer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory(filename);

    console.log("Deploying contracts with the account:", deployer.address, 'balance:', (await deployer.getBalance()).toString());
    console.log(`Deploying contract ${filename} with arguments: ${contractArgs}...`);

    const contract = await factory.deploy(...contractArgs);
    console.log("Contract deployed at address:", contract.address);

    const buildPath = saveContractBuildFile(filename, contract);
    console.log("Contract data saved at:", buildPath);

    return buildPath;
  }
}
