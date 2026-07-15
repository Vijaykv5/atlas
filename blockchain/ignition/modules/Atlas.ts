import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const AtlasModule = buildModule("AtlasModule", (m) => {
  const atlas = m.contract("Atlas");

  return { atlas };
});

export default AtlasModule;
