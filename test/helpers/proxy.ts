import {PRBProxy} from "@prb/proxy";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BaseContract, BigNumber, ContractTransaction} from "ethers";


export async function executeViaProxy(proxy:PRBProxy,
                                      signer: SignerWithAddress,
                                      target: BaseContract,
                                      methodName:string,
                                      params: ReadonlyArray<any>):Promise<ContractTransaction> {
    // Encode the target contract call as calldata.
    const data: string = target.interface.encodeFunctionData(methodName, params);

    // let gasLimit = await target.estimateGas[methodName].apply(target, params.concat());
    let gasLimit = BigNumber.from(3_000_000);
    // todo: find a way to estimate gas limit

    // Execute the composite call.
    console.log("executeViaProxy proxy", proxy.address, " data: ", data);
    return proxy.execute(target.address, data, { gasLimit: gasLimit });
}