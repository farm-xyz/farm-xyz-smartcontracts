import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ethers} from "hardhat";
import {expect} from "chai";
import {BigNumber} from "ethers";
import {TFarmXToken} from "../typechain";

describe("TFarmXToken actions", () => {
  let tFarmXToken: TFarmXToken;
  let owner: SignerWithAddress;

  beforeEach(async () => {
    const TFarmXToken = await ethers.getContractFactory("TFarmXToken");
    tFarmXToken = await TFarmXToken.deploy();
    await tFarmXToken.deployed();

    [owner] = await ethers.getSigners();
  })

  it("Should initialize", async () => {
    expect(tFarmXToken).to.be.ok;
    expect(owner).to.be.ok;
  })

  it("Should mint tokens", async () => {
    const amount: BigNumber = ethers.utils.parseEther("500000");

    await tFarmXToken.mint(owner.address, amount);

    const balance = await tFarmXToken.balanceOf(owner.address);
    expect(await tFarmXToken.totalSupply()).to.eq(balance);
  });
})
