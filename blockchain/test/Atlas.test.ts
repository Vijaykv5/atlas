import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const TITLE = "The night we won together";
const COUNTRY = "Singapore";
const KIND = "story";
const DESCRIPTION = "A permanent memory stored directly on Avalanche.";
const IMAGE_CID = "https://atlas.example/api/memories/metadata/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

  it("exposes ERC-721 collection metadata", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.name()).to.equal("Atlas Memories");
    expect(await atlas.symbol()).to.equal("ATLAS");
    expect(await atlas.supportsInterface("0x80ac58cd")).to.equal(true);
    expect(await atlas.supportsInterface("0x5b5e139f")).to.equal(true);
  });

  it("a user can create a valid memory", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
  });

  it("mints the memory as an ERC-721 NFT to the creator", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID))
      .to.emit(atlas, "Transfer")
      .withArgs(ethers.ZeroAddress, creator.address, 1);

    expect(await atlas.ownerOf(1)).to.equal(creator.address);
    expect(await atlas.balanceOf(creator.address)).to.equal(1);
  });

  it("uses the memory ID as the NFT token ID", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("First", "Singapore", "story", "First note", "bafyfirst");
    await atlas.connect(creator).createMemory("Second", "Japan", "voice", "Second note", "bafysecond");

    expect(await atlas.ownerOf(1)).to.equal(creator.address);
    expect(await atlas.ownerOf(2)).to.equal(creator.address);
    expect(await atlas.balanceOf(creator.address)).to.equal(2);
  });

  it("returns the public metadata URI for minted memory NFTs", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);
    const tokenUri = await atlas.tokenURI(1);

    expect(tokenUri).to.equal(IMAGE_CID);
  });

  it("allows approved NFT transfers without changing the immutable memory creator", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);
    await atlas.connect(creator).approve(otherCreator.address, 1);
    await atlas.connect(otherCreator).transferFrom(creator.address, otherCreator.address, 1);
    const memory = await atlas.getMemory(1);

    expect(await atlas.ownerOf(1)).to.equal(otherCreator.address);
    expect(await atlas.balanceOf(creator.address)).to.equal(0);
    expect(await atlas.balanceOf(otherCreator.address)).to.equal(1);
    expect(memory.creator).to.equal(creator.address);
  });

  it("memoryCount increases after publishing", async function () {
    const { atlas } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);

    expect(await atlas.memoryCount()).to.equal(1);
  });

  it("memory IDs begin at one", async function () {
    const { atlas } = await deployAtlasFixture();

    expect(await atlas.createMemory.staticCall(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID)).to.equal(1);
  });

  it("stores all on-chain memory fields correctly", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);
    const memory = await atlas.getMemory(1);

    expect(memory.creator).to.equal(creator.address);
    expect(memory.title).to.equal(TITLE);
    expect(memory.country).to.equal(COUNTRY);
    expect(memory.kind).to.equal(KIND);
    expect(memory.description).to.equal(DESCRIPTION);
    expect(memory.imageCid).to.equal(IMAGE_CID);
  });

  it("populates createdAt from the block timestamp", async function () {
    const { atlas } = await deployAtlasFixture();

    const tx = await atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const memory = await atlas.getMemory(1);

    expect(memory.createdAt).to.equal(block!.timestamp);
  });

  it("emits MemoryCreated with the correct arguments", async function () {
    const { atlas, creator } = await deployAtlasFixture();
    const timestamp = (await time.latest()) + 60;

    await time.setNextBlockTimestamp(timestamp);

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID))
      .to.emit(atlas, "MemoryCreated")
      .withArgs(1, creator.address, TITLE, COUNTRY, KIND, DESCRIPTION, IMAGE_CID, timestamp);
  });

  it("reverts when title is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory("", COUNTRY, KIND, DESCRIPTION, IMAGE_CID))
      .to.be.revertedWithCustomError(atlas, "EmptyTitle");
  });

  it("reverts when country is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, "", KIND, DESCRIPTION, IMAGE_CID))
      .to.be.revertedWithCustomError(atlas, "EmptyCountry");
  });

  it("reverts when kind is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, "", DESCRIPTION, IMAGE_CID))
      .to.be.revertedWithCustomError(atlas, "EmptyKind");
  });

  it("reverts when description is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, "", IMAGE_CID))
      .to.be.revertedWithCustomError(atlas, "EmptyDescription");
  });

  it("reverts when image CID is empty", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.createMemory(TITLE, COUNTRY, KIND, DESCRIPTION, ""))
      .to.be.revertedWithCustomError(atlas, "EmptyImageCid");
  });

  it("reverts when reading memory ID zero", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.getMemory(0)).to.be.revertedWithCustomError(atlas, "MemoryDoesNotExist");
  });

  it("reverts when reading a nonexistent memory ID", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.getMemory(99)).to.be.revertedWithCustomError(atlas, "MemoryDoesNotExist");
  });

  it("reverts when reading the owner for a nonexistent token ID", async function () {
    const { atlas } = await deployAtlasFixture();

    await expect(atlas.ownerOf(99)).to.be.revertedWithCustomError(atlas, "MemoryDoesNotExist");
  });

  it("allows multiple users to publish memories", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory(
      "First memory",
      "Singapore",
      "story",
      "Creator memory",
      "bafycreator",
    );
    await atlas.connect(otherCreator).createMemory(
      "Second memory",
      "Indonesia",
      "photo",
      "Other creator memory",
      "bafyother",
    );

    const firstMemory = await atlas.getMemory(1);
    const secondMemory = await atlas.getMemory(2);

    expect(firstMemory.creator).to.equal(creator.address);
    expect(secondMemory.creator).to.equal(otherCreator.address);
    expect(await atlas.memoryCount()).to.equal(2);
  });

  it("allows one wallet to publish multiple memories", async function () {
    const { atlas, creator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("First", "Singapore", "story", "First note", "bafyfirst");
    await atlas.connect(creator).createMemory("Second", "Japan", "voice", "Second note", "bafysecond");

    const creatorMemoryIds = await atlas.getMemoriesByCreator(creator.address);

    expect(creatorMemoryIds).to.deep.equal([BigInt(1), BigInt(2)]);
  });

  it("getMemoriesByCreator returns the correct memory IDs", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("First", "Singapore", "story", "First note", "bafyfirst");
    await atlas.connect(otherCreator).createMemory("Other", "Japan", "photo", "Other note", "bafyother");
    await atlas.connect(creator).createMemory("Third", "France", "video", "Third note", "bafythird");

    expect(await atlas.getMemoriesByCreator(creator.address)).to.deep.equal([
      BigInt(1),
      BigInt(3),
    ]);
    expect(await atlas.getMemoriesByCreator(otherCreator.address)).to.deep.equal([BigInt(2)]);
  });

  it("prevents one user from affecting another user's stored memories", async function () {
    const { atlas, creator, otherCreator } = await deployAtlasFixture();

    await atlas.connect(creator).createMemory("Creator title", "Singapore", "story", "Creator note", "bafycreator");
    await atlas.connect(otherCreator).createMemory("Other title", "Australia", "photo", "Other note", "bafyother");

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
