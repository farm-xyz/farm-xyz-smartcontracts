// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import fs from "fs";
import {ethers} from "hardhat";

const Confirm = require('prompt-confirm');

async function main(name: string | undefined) {
  console.log('Token name:', name);
  if (typeof name !== 'string') {
    throw new Error('Expected a token name defined in .env');
  }

  const sourcePath = process.cwd() + `/contracts/${name}.sol`;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`The token is expected to have a contract defined in "/contracts" dir, named ${name}.sol`);
  }

  const buildPath = process.cwd() + `/build/contracts/${name}.json`;
  if (fs.existsSync(buildPath)) {
    throw new Error(`The token is already deployed at: ${buildPath}`);
  }

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  console.log("ENV", process.env.ROPSTEN_PRIVATE_KEY, process.env.ROPSTEN_ALCHEMY_API_KEY);
  const confirmation = new Confirm(`Deploy token ${sourcePath}?`);
  const response = await confirmation.run();
  if (response !== true) {
    throw new Error('Deployment not confirmed!');
  }

  const factory = await ethers.getContractFactory(name);
  const token = await factory.deploy();
  console.log("Token deployed with address:", token.address);

  fs.writeFileSync(buildPath, JSON.stringify(token));

  console.log("Token data saved at:", buildPath);
  console.log("Account balance:", (await deployer.getBalance()).toString());
}

main(process.env.DEPLOY_TOKEN_NAME)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
