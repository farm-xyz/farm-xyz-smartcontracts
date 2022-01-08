// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import {ethers} from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance: ", (await deployer.getBalance()).toString());
  console.log("ENV", process.env.ROPSTEN_PRIVATE_KEY, process.env.ROPSTEN_ALCHEMY_API_KEY);

  const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
  const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
  const FarmXYZBase = await ethers.getContractFactory("FarmXYZBase");

  let _apy = 50;
  let rewardToken = await RFarmXToken.deploy();
  let stakeToken = await TFarmXToken.deploy();
  let farmXYZ = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);
  console.log("FarmXYZ #1 - small:", farmXYZ, {_apy});

  _apy = 70;
  rewardToken = await RFarmXToken.deploy();
  stakeToken = await TFarmXToken.deploy();
  farmXYZ = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);
  console.log("FarmXYZ #1 - medium:", farmXYZ, {_apy});

  _apy = 120;
  rewardToken = await RFarmXToken.deploy();
  stakeToken = await TFarmXToken.deploy();
  farmXYZ = await FarmXYZBase.deploy(stakeToken.address, rewardToken.address, _apy);
  console.log("FarmXYZ #1 - large:", farmXYZ, {_apy});
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
