import { expect } from "chai";
import { ethers } from "hardhat";


/* TODO: tests

tf = deploy TFarmXToken
rf = deploy RFarmxToken
deploy FarmXBase(address(tf), address(rf))

1. Mint rewards - 1 mil RFarmX
2. deposit rewards to reward pool
3. Mint tokens - 500k TFarmX
4. stake TFarmX
5. withdraw Yield
6. unstake Tokens - check that yield is also calculated
7. Check total value locked


---
8. Check what happens when there aren't enough reward tokens in the pool
* */


describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
