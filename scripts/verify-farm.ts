import {execSync} from "child_process";
import {FarmXYZTools} from "./utils/FarmXYZTools";

async function main() {
  const farmBuildFilename = await FarmXYZTools.promptInput('What is the farm build filename?');

  const {farmName, farm, stakeToken, rewardToken, apy} = await FarmXYZTools.extractFarmArgsFromBuildFilename(farmBuildFilename);
  console.log('args', {farmName, farm, stakeToken, rewardToken, apy});

  const cmd = `npx hardhat verify --network ropsten --contract contracts/${farmName}.sol:${farmName} ${farm.address} ${stakeToken.address} ${rewardToken.address} ${apy}`;
  console.log(`Execute command: ${cmd}`);

  const output = execSync(cmd);
  console.log(`output: ${output}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
