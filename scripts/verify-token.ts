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

async function main(filename: string | undefined) {
  if (!filename) {
    filename = await (new Input({
      type: 'input',
      name: 'filename',
      message: 'What is deployed contract filename?',
      skip: false,
      validate: (value: any) => typeof value === 'string' && fs.existsSync(getContractPath(value))
    })).run();
  }
  if (typeof filename !== 'string') {
    throw new Error('Expected a token name as 1st argument');
  }
  const contract = readContractFile(filename);
  const contractName = filename.substring(0, filename.indexOf('.json'));
  const contractPath = process.cwd() + `/contracts/${contractName}.sol`;
  if (!fs.existsSync(contractPath)) {
    throw new Error(`Contract ${contractPath} does not exists in project`);
  }
  console.log('Arguments:', filename, contractName, contract.address);

  const cmd = `npx hardhat verify --network ropsten --contract contracts/${contractName}.sol:${contractName} ${contract.address}`;
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
