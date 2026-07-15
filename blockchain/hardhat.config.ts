import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import "dotenv/config";

const DEFAULT_FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
const FUJI_CHAIN_ID = 43113;

const fujiRpcUrl = process.env.FUJI_RPC_URL || DEFAULT_FUJI_RPC_URL;
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const fujiNetworkRequested =
  process.argv.includes("--network") && process.argv.includes("fuji");

function getFujiAccounts(): string[] {
  if (!deployerPrivateKey) {
    if (fujiNetworkRequested) {
      throw new Error(
        "Missing DEPLOYER_PRIVATE_KEY. Add it to blockchain/.env before deploying to Avalanche Fuji."
      );
    }

    return [];
  }

  const normalizedPrivateKey = deployerPrivateKey.startsWith("0x")
    ? deployerPrivateKey
    : `0x${deployerPrivateKey}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedPrivateKey)) {
    throw new Error(
      "Invalid DEPLOYER_PRIVATE_KEY. Expected a 32-byte hex private key, with or without 0x."
    );
  }

  return [normalizedPrivateKey];
}

task("deploy:report", "Prints Fuji deployment details for an Atlas contract")
  .addParam("address", "Deployed Atlas contract address")
  .setAction(async ({ address }, hre) => {
    const [deployer] = await hre.ethers.getSigners();
    const network = await hre.ethers.provider.getNetwork();
    const explorerUrl = `https://testnet.snowtrace.io/address/${address}`;

    console.log("Atlas deployed and confirmed");
    console.log(`Contract address: ${address}`);
    console.log(`Network name: ${hre.network.name}`);
    console.log(`Chain ID: ${network.chainId.toString()}`);
    console.log(`Deployer address: ${deployer.address}`);
    console.log(`Fuji explorer URL: ${explorerUrl}`);
  });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    fuji: {
      url: fujiRpcUrl,
      chainId: FUJI_CHAIN_ID,
      accounts: getFujiAccounts()
    }
  }
};

export default config;
