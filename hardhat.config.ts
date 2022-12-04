import * as dotenv from "dotenv";

import {HardhatUserConfig, task} from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import '@openzeppelin/hardhat-upgrades';
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomiclabs/hardhat-web3";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import 'hardhat-preprocessor';
import {ethers} from "ethers";
import {removeConsoleLog} from "hardhat-preprocessor";

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
        POLYGONSCAN_API_KEY,
        TEST_ACCOUNT2_PRIVATE_KEY,
        TEST_ACCOUNT3_PRIVATE_KEY,
        FARM_XYZ_POOLS_CONTROL_KEY,
        BSC_MAINNET_RPC_PROVIDER,
        BSC_TESTNET_RPC_PROVIDER,
        BSC_PRIVATE_KEY} = process.env;


const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.4",
    settings: { optimizer: { enabled: true, runs: 200, details: { yul: false }, }, }
  },
  networks: {
    hardhat: {
      forking: {
        url: BSC_MAINNET_RPC_PROVIDER as string,
        blockNumber: 23595850,
        // url: POLYGON_RPC_PROVIDER as string,
        // blockNumber: 35670775
        // url: POLYGON_MUMBAI_RPC_PROVIDER as string,
        // blockNumber: 28895947
      },
      accounts: [
        {
          privateKey: POLYGON_PRIVATE_KEY as string,
          balance: ethers.utils.parseEther("10000000").toString(),
        },
        {
          privateKey: TEST_ACCOUNT2_PRIVATE_KEY as string,
          balance: ethers.utils.parseEther("10000000").toString(),
        },
        {
          privateKey: TEST_ACCOUNT3_PRIVATE_KEY as string,
          balance: ethers.utils.parseEther("10000000").toString(),
        },
        {
          privateKey: FARM_XYZ_POOLS_CONTROL_KEY as string,
          balance: ethers.utils.parseEther("10000000").toString(),
        }
      ]
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
    },
    bsc: {
        url: BSC_MAINNET_RPC_PROVIDER,
        accounts: [ `0x${BSC_PRIVATE_KEY}` ]
    },
    bsc_testnet: {
        url: BSC_TESTNET_RPC_PROVIDER,
        accounts: [ `0x${BSC_PRIVATE_KEY}` ]
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    token: "MATIC",
    gasPriceApi: "https://api.polygonscan.com/api?module=proxy&action=eth_gasPrice",
    // proxyResolver: function() {
    //   console.log('proxyResolver', arguments);
    //   // @ts-ignore
    //   return this.resolveByMethodSignature.apply(this, arguments);
    //   // return new ethers.providers.Web3Provider(provider).getSigner(proxy.address);
    // }
  },
  etherscan: {
    apiKey: {
      ropsten: ETH_ROPSTEN_ETHERSCAN_API_KEY as string,
      polygon: POLYGONSCAN_API_KEY as string,
      polygonMumbai: POLYGONSCAN_API_KEY as string
    },

  },
  // preprocess: {
  //   eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat' && hre.network.name !== 'localhost'),
  // },
};

export default config;
