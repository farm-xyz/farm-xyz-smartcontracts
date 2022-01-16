// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import "@nomiclabs/hardhat-etherscan";
import {FarmXYZTools} from "./utils/FarmXYZTools";

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
