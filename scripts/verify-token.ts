import fs from "fs";
import {execSync} from "child_process";

async function main(name: string | undefined, address: string | undefined) {
  console.log('Arguments:', name, address);
  if (typeof name !== 'string') {
    throw new Error('Expected a token name as 1st argument');
  }
  if (typeof address !== 'string') {
    throw new Error('Expected a token address as 2nd argument');
  }

  const sourcePath = process.cwd() + `/contracts/${name}.sol`;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`The token is expected to have a contract defined in "/contracts" dir, named ${name}.sol`);
  }

  const cmd = `npx hardhat verify --network ropsten --contract contracts/${name}.sol:${name} ${address}`;
  console.log(`Execute command: ${cmd}`);

  const output = execSync(cmd);
  console.log(`output: ${output}`);
}

main(process.argv[2], process.argv[3])
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
