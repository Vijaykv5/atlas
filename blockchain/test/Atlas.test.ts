import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const TITLE = "The night we won together";
const COUNTRY = "Singapore";
const KIND = "story";
const DESCRIPTION = "A permanent memory stored directly on Avalanche.";

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

    expect(await atlas.getAddress()).to.match(/^0x[0-9a-fA-F]{40}$/);
  });

  it("memoryCount starts at zero", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.memoryCount()).to.equal(0);
  });

  it("a user can create a valid memory", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
  });

  it("memoryCount increases after publishing", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION);

    expect(await atlas.memoryCount()).to.equal(1);
  });

  it("memory IDs begin at one", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.createMemory.staticCall(TITLE, COUNTRY, KIND, DESCRIPTION)).to.equal(1);
  });

  it("stores all on-chain memory fields correctly", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
    expect(memory.title).to.equal(TITLE);
    expect(memory.country).to.equal(COUNTRY);
    expect(memory.kind).to.equal(KIND);
    expect(memory.description).to.equal(DESCRIPTION);
  });

  it("populates createdAt from the block timestamp", async function () {
    const { atlas } = await deployAtlasFixture();

    const tx = await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const memory = await atlas.getMemory(1);

    expect(memory.createdAt).to.equal(block!.timestamp);
  });

  it("emits MemoryCreated with the correct arguments", async function () {
    const { atlas, creator } = await deployAtlasFixture();
    const timestamp = (await time.latest()) + 60;

    await time.setNextBlockTimestamp(timestamp);

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION))
      .to.emit(atlas, "MemoryCreated")
      .withArgs(1, creator.address, TITLE, COUNTRY, KIND, DESCRIPTION, timestamp);
  });

  it("reverts when title is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory("", COUNTRY, KIND, DESCRIPTION))
      .to.be.revertedWithCustomError(atlas, "EmptyTitle");
  });

  it("reverts when country is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, "", KIND, DESCRIPTION))
      .to.be.revertedWithCustomError(atlas, "EmptyCountry");
  });

  it("reverts when kind is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, "", DESCRIPTION))
      .to.be.revertedWithCustomError(atlas, "EmptyKind");
  });

  it("reverts when description is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, ""))
      .to.be.revertedWithCustomError(atlas, "EmptyDescription");
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

    await atlas.connect(creator).createMemory(
      "First memory",
      "Singapore",
      "story",
      "Creator memory",
    );
    await atlas.connect(otherCreator).createMemory(
      "Second memory",
      "Indonesia",
      "photo",
      "Other creator memory",
    );

    const firstMemory = await atlas.getMemory(1);
    const secondMemory = await atlas.getMemory(2);

    expect(firstMemory.creator).to.equal(creator.address);
    expect(secondMemory.creator).to.equal(otherCreator.address);
    expect(await atlas.memoryCount()).to.equal(2);
  });

  it("allows one wallet to publish multiple memories", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("First", "Singapore", "story", "First note");
    await atlas.connect(creator).createMemory("Second", "Japan", "voice", "Second note");

    const creatorMemoryIds = await atlas.getMemoriesByCreator(creator.address);

    expect(creatorMemoryIds).to.deep.equal([BigInt(1), BigInt(2)]);
  });

  it("getMemoriesByCreator returns the correct memory IDs", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("First", "Singapore", "story", "First note");
    await atlas.connect(otherCreator).createMemory("Other", "Japan", "photo", "Other note");
    await atlas.connect(creator).createMemory("Third", "France", "video", "Third note");

    expect(await atlas.getMemoriesByCreator(creator.address)).to.deep.equal([
      BigInt(1),
      BigInt(3),
    ]);
    expect(await atlas.getMemoriesByCreator(otherCreator.address)).to.deep.equal([BigInt(2)]);
  });

  it("prevents one user from affecting another user's stored memories", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("Creator title", "Singapore", "story", "Creator note");
    await atlas.connect(otherCreator).createMemory("Other title", "Australia", "photo", "Other note");

    const creatorMemory = await atlas.getMemory(1);
    const otherMemory = await atlas.getMemory(2);
    const creatorMemoryIds = await atlas.getMemoriesByCreator(creator.address);
    const otherMemoryIds = await atlas.getMemoriesByCreator(otherCreator.address);

    expect(creatorMemory.creator).to.equal(creator.address);
    expect(creatorMemory.title).to.equal("Creator title");
    expect(creatorMemory.description).to.equal("Creator note");
    expect(otherMemory.creator).to.equal(otherCreator.address);
    expect(otherMemory.title).to.equal("Other title");
    expect(otherMemory.description).to.equal("Other note");
    expect(creatorMemoryIds).to.deep.equal([BigInt(1)]);
    expect(otherMemoryIds).to.deep.equal([BigInt(2)]);
  });
});
