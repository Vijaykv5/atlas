// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Atlas
/// @notice Permissionless registry for immutable memories anchored to real-world coordinates.
/// @dev Stores only metadata URIs. Media and rich content should remain off-chain on IPFS.
contract Atlas {
    /// @notice Minimum latitude in E6 fixed-point format.
    int32 public constant MIN_LATITUDE_E6 = -90_000_000;

    /// @notice Maximum latitude in E6 fixed-point format.
    int32 public constant MAX_LATITUDE_E6 = 90_000_000;

    /// @notice Minimum longitude in E6 fixed-point format.
    int32 public constant MIN_LONGITUDE_E6 = -180_000_000;

    /// @notice Maximum longitude in E6 fixed-point format.
    int32 public constant MAX_LONGITUDE_E6 = 180_000_000;

    /// @notice A published Atlas memory.
    /// @param id Unique memory ID. IDs start at 1.
    /// @param creator Wallet that published the memory.
    /// @param latitudeE6 Latitude encoded as a signed integer with six decimals.
    /// @param longitudeE6 Longitude encoded as a signed integer with six decimals.
    /// @param metadataURI IPFS URI pointing to the memory metadata.
    /// @param createdAt Block timestamp captured when the memory was published.
    struct Memory {
        uint256 id;
        address creator;
        int32 latitudeE6;
        int32 longitudeE6;
        string metadataURI;
        uint64 createdAt;
    }

    /// @notice Reverts when the metadata URI is empty.
    error EmptyMetadataURI();

    /// @notice Reverts when latitude is outside [-90, 90] degrees in E6 format.
    error InvalidLatitude();

    /// @notice Reverts when longitude is outside [-180, 180] degrees in E6 format.
    error InvalidLongitude();

    /// @notice Reverts when a memory ID has not been published.
    error MemoryDoesNotExist();

    /// @notice Emitted when a memory is permanently published.
    event MemoryCreated(
        uint256 indexed memoryId,
        address indexed creator,
        int32 latitudeE6,
        int32 longitudeE6,
        string metadataURI,
        uint64 createdAt
    );

    /// @notice Number of memories published.
    uint256 public memoryCount;

    mapping(uint256 => Memory) private memories;
    mapping(address => uint256[]) private memoriesByCreator;

    /// @notice Publish an immutable memory anchored to latitude and longitude.
    /// @param latitudeE6 Latitude encoded with six fixed decimals.
    /// @param longitudeE6 Longitude encoded with six fixed decimals.
    /// @param metadataURI IPFS URI for the off-chain metadata JSON.
    /// @return memoryId The newly assigned memory ID.
    function createMemory(
        int32 latitudeE6,
        int32 longitudeE6,
        string calldata metadataURI
    ) external returns (uint256 memoryId) {
        if (latitudeE6 < MIN_LATITUDE_E6 || latitudeE6 > MAX_LATITUDE_E6) {
            revert InvalidLatitude();
        }

        if (longitudeE6 < MIN_LONGITUDE_E6 || longitudeE6 > MAX_LONGITUDE_E6) {
            revert InvalidLongitude();
        }

        if (bytes(metadataURI).length == 0) {
            revert EmptyMetadataURI();
        }

        memoryId = memoryCount + 1;
        uint64 createdAt = uint64(block.timestamp);

        memories[memoryId] = Memory({
            id: memoryId,
            creator: msg.sender,
            latitudeE6: latitudeE6,
            longitudeE6: longitudeE6,
            metadataURI: metadataURI,
            createdAt: createdAt
        });

        memoriesByCreator[msg.sender].push(memoryId);
        memoryCount = memoryId;

        emit MemoryCreated(memoryId, msg.sender, latitudeE6, longitudeE6, metadataURI, createdAt);
    }

    /// @notice Return a published memory by ID.
    /// @param memoryId Memory ID to read.
    /// @return memoryItem The stored memory.
    function getMemory(uint256 memoryId) external view returns (Memory memoryItem) {
        if (memoryId == 0 || memoryId > memoryCount) {
            revert MemoryDoesNotExist();
        }

        return memories[memoryId];
    }

    /// @notice Return all memory IDs created by a wallet.
    /// @param creator Wallet address to query.
    /// @return Array of memory IDs created by the wallet.
    function getMemoriesByCreator(address creator) external view returns (uint256[] memory) {
        return memoriesByCreator[creator];
    }
}
