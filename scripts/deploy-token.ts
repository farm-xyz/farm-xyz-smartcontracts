// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import {FarmXYZTools} from "./utils/FarmXYZTools";

async function main() {
  const tokenName = await FarmXYZTools.promptInput('What is the token contract name?');
  const buildPath = await FarmXYZTools.deployToken(tokenName);
  console.log(`Deployed at: ${buildPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
