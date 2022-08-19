import * as dotenv from "dotenv";

import {HardhatUserConfig, task} from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more


const { ETH_MAINNET_RPC_PROVIDER,
        ETH_ROPSTEN_ETHERSCAN_API_KEY,
        ETH_ROPSTEN_RPC_PROVIDER,
        ETH_ROPSTEN_PRIVATE_KEY,
        POLYGON_MUMBAI_RPC_PROVIDER,
        POLYGON_RPC_PROVIDER,
        POLYGON_PRIVATE_KEY,
        POLYGONSCAN_API_KEY } = process.env;


const config: HardhatUserConfig = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      forking: {
        url: ETH_MAINNET_RPC_PROVIDER as string,
        blockNumber: 13889838
      }
    },
    ropsten: {
      url: ETH_ROPSTEN_RPC_PROVIDER,
      accounts: [`0x${ETH_ROPSTEN_PRIVATE_KEY}`],
    },
    polygon: {
      url: POLYGON_RPC_PROVIDER,
      accounts: [ `0x${POLYGON_PRIVATE_KEY}` ]
    },
    mumbai: {
      url: POLYGON_MUMBAI_RPC_PROVIDER,
      accounts: [ `0x${POLYGON_PRIVATE_KEY}` ]
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: {
      ropsten: ETH_ROPSTEN_ETHERSCAN_API_KEY as string,
      polygon: POLYGONSCAN_API_KEY as string,
      polygonMumbai: POLYGONSCAN_API_KEY as string
    },

  },
};

export default config;
