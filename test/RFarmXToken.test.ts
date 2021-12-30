import {expect} from "chai";
import {ethers} from "hardhat";
import {RFarmXToken} from "../typechain";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";

describe("Reward farm X token actions", () => {
  let rFarmXToken: RFarmXToken;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    const RFarmXToken = await ethers.getContractFactory("RFarmXToken");
    rFarmXToken = await RFarmXToken.deploy();
    await rFarmXToken.deployed();

    [owner] = await ethers.getSigners();
  })

  it("Should initialize", async () => {
    expect(rFarmXToken).to.be.ok;
    expect(owner).to.be.ok;
  })

  it("Should mint rewards", async () => {
    const amount: BigNumber = ethers.utils.parseEther("1000000");

    await rFarmXToken.mint(owner.address, amount);

    const balance = await rFarmXToken.balanceOf(owner.address);
    expect(await rFarmXToken.totalSupply()).to.eq(balance);
  });
});
