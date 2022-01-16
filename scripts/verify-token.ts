import {FarmXYZTools} from "./utils/FarmXYZTools";
import {execSync} from "child_process";

async function main() {
  const filename = await FarmXYZTools.promptInput('What is the token build filename?');
  const contract = await FarmXYZTools.readContractBuildFile(filename);
  const filenameWithoutExtension = filename.replace(/(.sol|.json)$/g, '');

  const cmd = `npx hardhat verify --network ropsten --contract contracts/${filenameWithoutExtension}.sol:${filenameWithoutExtension} ${contract.address}`;
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
