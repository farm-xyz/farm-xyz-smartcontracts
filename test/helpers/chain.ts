import {ethers, network } from "hardhat";
import {Contract} from "ethers";
import {ERC20} from "../../typechain";
import {parseUnits} from "ethers/lib/utils";
import {BigNumber} from "@ethersproject/bignumber";

export async function resetToBlock(block:number)
{
    // move to another block
    await network.provider.request({
        method: "hardhat_reset",
        params: [
                {
                    forking: {
                        jsonRpcUrl: process.env.POLYGON_RPC_PROVIDER,
                        blockNumber: block,
                },
                accounts: [
                    {
                        privateKey: process.env.POLYGON_PRIVATE_KEY,
                        balance: ethers.utils.parseEther("10000000").toString(),
                    }
                ]
            },
        ],
    });
}


export async function setTokenBalance(tokenName: string, wallet:string, newBalance: BigNumber)
{
    const tokensMapping: { [key:string]: { [key: string]: { address: string; slot: number } }} = {
        "hardhat": {
            "USDC": {
                address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
                // address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon
                slot: 2
            },
            "DAI": {
                address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
                slot: 2
            },
            "USDT": {
                address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
                slot: 2
            },
        },
        "polygon": {
            "USDC": {
                address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
                slot: 2
            },
            "DAI": {
                address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
                slot: 2
            },
            "USDT": {
                address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
                slot: 2
            },
        }
    };
    const networkName = network.name;
    console.log("[setTokenBalance] Current network: " + networkName);
    const tokenConfig = tokensMapping[networkName][tokenName];
    if (tokenConfig === undefined) {
        throw new Error("Token not found");
    }

    const ERC20Factory = await ethers.getContractFactory("ERC20");
    const token = ERC20Factory.attach(tokenConfig.address);
    const slot = await findSlot(token, wallet);
    if (slot<0) {
        throw new Error("[setTokenBalance] Slot not found token " + tokenName + " address " + wallet+ ", probably the wallet has no balance");
    }
    console.log("[setTokenBalance] token " + tokenName + " address " + wallet +" slot " + slot + " new balance " + newBalance.toString());

    // Get storage slot index
    const index = ethers.utils.solidityKeccak256(
        ["uint256", "uint256"],
        [wallet, slot] // key, slot
    );

    // Manipulate local balance (needs to be bytes32 string)
    await setStorageAt(
        token.address,
        index.toString(),
        toBytes32(newBalance).toString()
    );
}


async function findSlot(
    token:ERC20,
    tokenHolderAddress:string,
    maxSlot:number = 100
):Promise<number> {
    const provider = ethers.provider;

    let tokenSymbol = await token.symbol();
    let tokenDecimals = await token.decimals();

    const holderBal = await token.balanceOf(tokenHolderAddress);
    if (holderBal.eq(ethers.constants.Zero)) {
        console.log("Token holder has no balance");
        return -1;
    }

    for (let i = 0; i <= maxSlot; i++) {
        const d = await provider.getStorageAt(
            token.address,
            ethers.utils.solidityKeccak256(
                ["uint256", "uint256"],
                [tokenHolderAddress, i] // key, slot (solidity)
            )
        );

        let n = ethers.constants.Zero;

        try {
            n = ethers.BigNumber.from(d);
        } catch (e) {
            /* */
        }

        if (n.eq(holderBal)) {
            return i;
        }
    }

    for (let i = 0; i <= maxSlot; i++) {
        const d = await provider.getStorageAt(
            token.address,
            ethers.utils.solidityKeccak256(
                ["uint256", "uint256"],
                [i, tokenHolderAddress] // slot, key (vyper)
            )
        );

        let n = ethers.constants.Zero;

        try {
            n = ethers.BigNumber.from(d);
        } catch (e) {
            /* */
        }

        if (n.eq(holderBal)) {
            return i;
        }
    }

    return -1;
}

function toBytes32(bn:BigNumber) {
    return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
}

async function setStorageAt(address:string, index:string, value:string) {
    await ethers.provider.send("hardhat_setStorageAt", [address, index, value]);
    await ethers.provider.send("evm_mine", []); // Just mines to the next block
}
