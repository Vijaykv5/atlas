// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Atlas
/// @notice Permissionless registry for immutable memories stored directly on-chain.
contract Atlas {
    /// @notice A published Atlas memory.
    /// @param id Unique memory ID. IDs start at 1.
    /// @param creator Wallet that published the memory.
    /// @param title Short title for the memory.
    /// @param country Country associated with the memory.
    /// @param kind Memory type selected by the creator.
    /// @param description Full on-chain memory note.
    /// @param createdAt Block timestamp captured when the memory was published.
    struct Memory {
        uint256 id;
        address creator;
        string title;
        string country;
        string kind;
        string description;
        uint64 createdAt;
    }

    /// @notice Reverts when the title is empty.
    error EmptyTitle();

    /// @notice Reverts when the country is empty.
    error EmptyCountry();

    /// @notice Reverts when the memory type is empty.
    error EmptyKind();

    /// @notice Reverts when the description is empty.
    error EmptyDescription();

    /// @notice Reverts when a memory ID has not been published.
    error MemoryDoesNotExist();

    /// @notice Emitted when a memory is permanently published.
    event MemoryCreated(
        uint256 indexed memoryId,
        address indexed creator,
        string title,
        string country,
        string kind,
        string description,
        uint64 createdAt
    );

    /// @notice Number of memories published.
    uint256 public memoryCount;

    mapping(uint256 => Memory) private memories;
    mapping(address => uint256[]) private memoriesByCreator;

    /// @notice Publish an immutable memory stored directly on-chain.
    /// @param title Short title for the memory.
    /// @param country Country associated with the memory.
    /// @param kind Memory type selected by the creator.
    /// @param description Full on-chain memory note.
    /// @return memoryId The newly assigned memory ID.
    function createMemory(
        string calldata title,
        string calldata country,
        string calldata kind,
        string calldata description
    ) external returns (uint256 memoryId) {
        if (bytes(title).length == 0) {
            revert EmptyTitle();
        }

        if (bytes(country).length == 0) {
            revert EmptyCountry();
        }

        if (bytes(kind).length == 0) {
            revert EmptyKind();
        }

        if (bytes(description).length == 0) {
            revert EmptyDescription();
        }

        memoryId = memoryCount + 1;
        uint64 createdAt = uint64(block.timestamp);

        memories[memoryId] = Memory({
            id: memoryId,
            creator: msg.sender,
            title: title,
            country: country,
            kind: kind,
            description: description,
            createdAt: createdAt
        });

        memoriesByCreator[msg.sender].push(memoryId);
        memoryCount = memoryId;

        emit MemoryCreated(memoryId, msg.sender, title, country, kind, description, createdAt);
    }

    /// @notice Return a published memory by ID.
    /// @param memoryId Memory ID to read.
    /// @return memoryItem The stored memory.
    function getMemory(uint256 memoryId) external view returns (Memory memory memoryItem) {
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
