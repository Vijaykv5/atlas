import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const LATITUDE = 1_352_083;
const LONGITUDE = 103_625_213;
const METADATA_URI = "ipfs://bafy-atlas-memory";

describe("Atlas", function () {
  async function deployAtlasFixture() {
    const [creator, otherCreator] = await ethers.getSigners();
    const Atlas = await ethers.getContractFactory("Atlas");
    const atlas = await Atlas.deploy();
    await atlas.waitForDeployment();

    return { atlas, creator, otherCreator };
  }

  it("deploys successfully", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.getAddress()).to.properAddress;
  });

  it("memoryCount starts at zero", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.memoryCount()).to.equal(0);
  });

  it("a user can create a valid memory", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
  });

  it("memoryCount increases after publishing", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);

    expect(await atlas.memoryCount()).to.equal(1);
  });

  it("memory IDs begin at one", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.createMemory.staticCall(LATITUDE, LONGITUDE, METADATA_URI)).to.equal(1);
  });

  it("stores the creator address correctly", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
  });

  it("stores latitude correctly", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const memory = await atlas.getMemory(1);

    expect(memory.latitudeE6).to.equal(LATITUDE);
  });

  it("stores longitude correctly", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const memory = await atlas.getMemory(1);

    expect(memory.longitudeE6).to.equal(LONGITUDE);
  });

  it("stores the metadata URI correctly", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const memory = await atlas.getMemory(1);

    expect(memory.metadataURI).to.equal(METADATA_URI);
  });

  it("populates createdAt from the block timestamp", async function () {
    const { atlas } = await deployAtlasFixture();

    const tx = await atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const memory = await atlas.getMemory(1);

    expect(memory.createdAt).to.equal(block!.timestamp);
  });

  it("emits MemoryCreated with the correct arguments", async function () {
    const { atlas, creator } = await deployAtlasFixture();
    const timestamp = (await time.latest()) + 60;

    await time.setNextBlockTimestamp(timestamp);

    await expect(atlas.createMemory(LATITUDE, LONGITUDE, METADATA_URI))
      .to.emit(atlas, "MemoryCreated")
      .withArgs(1, creator.address, LATITUDE, LONGITUDE, METADATA_URI, timestamp);
  });

  it("accepts the minimum valid latitude", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(-90_000_000, LONGITUDE, METADATA_URI)).to.not.be.reverted;
  });

  it("accepts the maximum valid latitude", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(90_000_000, LONGITUDE, METADATA_URI)).to.not.be.reverted;
  });

  it("accepts the minimum valid longitude", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(LATITUDE, -180_000_000, METADATA_URI)).to.not.be.reverted;
  });

  it("accepts the maximum valid longitude", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(LATITUDE, 180_000_000, METADATA_URI)).to.not.be.reverted;
  });

  it("reverts when latitude is below the minimum", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(-90_000_001, LONGITUDE, METADATA_URI))
      .to.be.revertedWithCustomError(atlas, "InvalidLatitude");
  });

  it("reverts when latitude is above the maximum", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(90_000_001, LONGITUDE, METADATA_URI))
      .to.be.revertedWithCustomError(atlas, "InvalidLatitude");
  });

  it("reverts when longitude is below the minimum", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(LATITUDE, -180_000_001, METADATA_URI))
      .to.be.revertedWithCustomError(atlas, "InvalidLongitude");
  });

  it("reverts when longitude is above the maximum", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(LATITUDE, 180_000_001, METADATA_URI))
      .to.be.revertedWithCustomError(atlas, "InvalidLongitude");
  });

  it("reverts when metadata URI is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(LATITUDE, LONGITUDE, ""))
      .to.be.revertedWithCustomError(atlas, "EmptyMetadataURI");
  });

  it("reverts when reading memory ID zero", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.getMemory(0)).to.be.revertedWithCustomError(atlas, "MemoryDoesNotExist");
  });

  it("reverts when reading a nonexistent memory ID", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.getMemory(99)).to.be.revertedWithCustomError(atlas, "MemoryDoesNotExist");
  });

  it("allows multiple users to publish memories", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(LATITUDE, LONGITUDE, "ipfs://creator-memory");
    await atlas.connect(otherCreator).createMemory(-7_250_445, 112_768_845, "ipfs://other-memory");

    const firstMemory = await atlas.getMemory(1);
    const secondMemory = await atlas.getMemory(2);

    expect(firstMemory.creator).to.equal(creator.address);
    expect(secondMemory.creator).to.equal(otherCreator.address);
    expect(await atlas.memoryCount()).to.equal(2);
  });

  it("allows one wallet to publish multiple memories", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(LATITUDE, LONGITUDE, "ipfs://first-memory");
    await atlas.connect(creator).createMemory(-6_175_392, 106_827_153, "ipfs://second-memory");

    const creatorMemoryIds = await atlas.getMemoriesByCreator(creator.address);

    expect(creatorMemoryIds).to.deep.equal([1n, 2n]);
  });

  it("getMemoriesByCreator returns the correct memory IDs", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(LATITUDE, LONGITUDE, "ipfs://first-memory");
    await atlas.connect(otherCreator).createMemory(35_689_500, 139_691_700, "ipfs://other-memory");
    await atlas.connect(creator).createMemory(48_856_600, 2_352_200, "ipfs://third-memory");

    expect(await atlas.getMemoriesByCreator(creator.address)).to.deep.equal([1n, 3n]);
    expect(await atlas.getMemoriesByCreator(otherCreator.address)).to.deep.equal([2n]);
  });

  it("prevents one user from affecting another user's stored memories", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(LATITUDE, LONGITUDE, "ipfs://creator-memory");
    await atlas.connect(otherCreator).createMemory(-33_868_800, 151_209_300, "ipfs://other-memory");

    const creatorMemory = await atlas.getMemory(1);
    const otherMemory = await atlas.getMemory(2);
    const creatorMemoryIds = await atlas.getMemoriesByCreator(creator.address);
    const otherMemoryIds = await atlas.getMemoriesByCreator(otherCreator.address);

    expect(creatorMemory.creator).to.equal(creator.address);
    expect(creatorMemory.metadataURI).to.equal("ipfs://creator-memory");
    expect(otherMemory.creator).to.equal(otherCreator.address);
    expect(otherMemory.metadataURI).to.equal("ipfs://other-memory");
    expect(creatorMemoryIds).to.deep.equal([1n]);
    expect(otherMemoryIds).to.deep.equal([2n]);
  });
});
