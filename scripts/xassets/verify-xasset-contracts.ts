import { ethers, upgrades } from "hardhat";
import {getPRBProxyRegistry, PRBProxyRegistry} from "@prb/proxy";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber} from "ethers";
import {ERC20, XAssetBase} from "../../typechain";
import {usdc} from "../../test/helpers/helpers";
import {verifyContract} from "@nomiclabs/hardhat-etherscan/dist/src/etherscan/EtherscanService";

async function main() {



}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
