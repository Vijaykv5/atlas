// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data)
        external
        returns (bytes4);
}

/// @title Atlas
/// @notice Permissionless ERC-721 collection for immutable memories stored directly on-chain.
contract Atlas {
    /// @notice A published Atlas memory.
    /// @param id Unique memory ID. IDs start at 1.
    /// @param creator Wallet that published the memory.
    /// @param title Short title for the memory.
    /// @param country Country associated with the memory.
    /// @param kind Memory type selected by the creator.
    /// @param description Full on-chain memory note.
    /// @param imageCid Public metadata URI for the memory NFT.
    /// @param createdAt Block timestamp captured when the memory was published.
    struct Memory {
        uint256 id;
        address creator;
        string title;
        string country;
        string kind;
        string description;
        string imageCid;
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

    /// @notice Reverts when the image CID is empty.
    error EmptyImageCid();

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
        string imageCid,
        uint64 createdAt
    );

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    /// @notice Number of memories published.
    uint256 public memoryCount;

    string public constant name = "Atlas Memories";
    string public constant symbol = "ATLAS";

    mapping(uint256 => Memory) private memories;
    mapping(address => uint256[]) private memoriesByCreator;
    mapping(uint256 => address) private owners;
    mapping(address => uint256) private balances;
    mapping(uint256 => address) private tokenApprovals;
    mapping(address => mapping(address => bool)) private operatorApprovals;

    /// @notice Publish an immutable memory stored directly on-chain.
    /// @param title Short title for the memory.
    /// @param country Country associated with the memory.
    /// @param kind Memory type selected by the creator.
    /// @param description Full on-chain memory note.
    /// @param imageCid Public metadata URI for the memory NFT.
    /// @return memoryId The newly assigned memory ID.
    function createMemory(
        string calldata title,
        string calldata country,
        string calldata kind,
        string calldata description,
        string calldata imageCid
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

        if (bytes(imageCid).length == 0) {
            revert EmptyImageCid();
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
            imageCid: imageCid,
            createdAt: createdAt
        });

        memoriesByCreator[msg.sender].push(memoryId);
        owners[memoryId] = msg.sender;
        balances[msg.sender] += 1;
        memoryCount = memoryId;

        emit Transfer(address(0), msg.sender, memoryId);
        emit MemoryCreated(memoryId, msg.sender, title, country, kind, description, imageCid, createdAt);
    }

    /// @notice Return how many Atlas memory NFTs a wallet owns.
    /// @param owner Wallet address to query.
    /// @return Balance of minted memory NFTs.
    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "ERC721: zero address");

        return balances[owner];
    }

    /// @notice Return the owner wallet for an Atlas memory NFT.
    /// @param tokenId Memory NFT ID to query.
    /// @return Owner wallet address.
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = owners[tokenId];

        if (owner == address(0)) {
            revert MemoryDoesNotExist();
        }

        return owner;
    }

    /// @notice Return collection metadata support for ERC-165, ERC-721, and ERC-721 metadata.
    /// @param interfaceId Interface ID to query.
    /// @return Whether the interface is supported.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 ||
            interfaceId == 0x80ac58cd ||
            interfaceId == 0x5b5e139f;
    }

    /// @notice Return metadata URI for a minted memory NFT.
    /// @param tokenId Memory NFT ID to query.
    /// @return Metadata URI containing the on-chain memory fields.
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        Memory storage memoryItem = memories[tokenId];

        if (memoryItem.creator == address(0)) {
            revert MemoryDoesNotExist();
        }

        return memoryItem.imageCid;
    }

    /// @notice Approve a wallet to transfer a single memory NFT.
    /// @param to Wallet to approve.
    /// @param tokenId Memory NFT ID.
    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);

        require(msg.sender == owner || operatorApprovals[owner][msg.sender], "ERC721: not approved");

        tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    /// @notice Return the approved wallet for a memory NFT.
    /// @param tokenId Memory NFT ID.
    /// @return Approved wallet address.
    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);

        return tokenApprovals[tokenId];
    }

    /// @notice Approve or revoke an operator for all caller memory NFTs.
    /// @param operator Operator wallet.
    /// @param approved Whether the operator is approved.
    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "ERC721: self approval");

        operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /// @notice Return whether an operator can transfer all owner memory NFTs.
    /// @param owner Owner wallet.
    /// @param operator Operator wallet.
    /// @return Whether the operator is approved.
    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return operatorApprovals[owner][operator];
    }

    /// @notice Transfer a memory NFT.
    /// @param from Current owner.
    /// @param to New owner.
    /// @param tokenId Memory NFT ID.
    function transferFrom(address from, address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);

        require(owner == from, "ERC721: wrong owner");
        require(to != address(0), "ERC721: zero address");
        require(
            msg.sender == owner ||
                tokenApprovals[tokenId] == msg.sender ||
                operatorApprovals[owner][msg.sender],
            "ERC721: not approved"
        );

        balances[from] -= 1;
        balances[to] += 1;
        owners[tokenId] = to;
        delete tokenApprovals[tokenId];

        emit Transfer(from, to, tokenId);
    }

    /// @notice Safely transfer a memory NFT.
    /// @param from Current owner.
    /// @param to New owner.
    /// @param tokenId Memory NFT ID.
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        _safeTransferFrom(from, to, tokenId, "");
    }

    /// @notice Safely transfer a memory NFT with calldata forwarded to the receiver.
    /// @param from Current owner.
    /// @param to New owner.
    /// @param tokenId Memory NFT ID.
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external {
        _safeTransferFrom(from, to, tokenId, data);
    }

    function _safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) private {
        transferFrom(from, to, tokenId);

        if (to.code.length == 0) {
            return;
        }

        require(
            IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) ==
                IERC721Receiver.onERC721Received.selector,
            "ERC721: unsafe receiver"
        );
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
