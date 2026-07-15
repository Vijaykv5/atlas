import hre from "hardhat";
import AtlasModule from "../ignition/modules/Atlas";

async function main() {
  if (hre.network.name !== "fuji") {
    throw new Error("Use the fuji network: bun run deploy:fuji");
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const { atlas } = await hre.ignition.deploy(AtlasModule);
  const address = await atlas.getAddress();

  const deploymentTransaction = atlas.deploymentTransaction();
  if (!deploymentTransaction) {
    throw new Error("Could not find the Atlas deployment transaction.");
  }

  await deploymentTransaction.wait();

  console.log("Atlas deployed and confirmed");
  console.log(`Contract address: ${address}`);
  console.log(`Network name: ${hre.network.name}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Fuji explorer URL: https://testnet.snowtrace.io/address/${address}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
