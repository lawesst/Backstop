// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../lib/reactive-lib/src/abstract-base/AbstractCallback.sol";
import "./IERC20Like.sol";

contract BackstopVault is AbstractCallback {
    struct PositionConfig {
        address owner;
        uint256 availableReserve;
        uint256 committedReserve;
        uint256 minHealthFactor;
        uint256 rescueAmount;
        uint256 cooldownBlocks;
        bool active;
    }

    IERC20Like public immutable asset;

    mapping(bytes32 => PositionConfig) public positions;

    event ProtectionConfigured(
        bytes32 indexed positionId,
        address indexed owner,
        uint256 minHealthFactor,
        uint256 rescueAmount,
        uint256 cooldownBlocks
    );

    event ReserveUpdated(
        bytes32 indexed positionId,
        uint256 availableReserve,
        uint256 committedReserve
    );

    event ReserveCommitted(
        bytes32 indexed positionId,
        uint256 amount,
        address indexed reactiveSender
    );

    constructor(IERC20Like asset_, address callbackSender_) payable AbstractCallback(callbackSender_) {
        asset = asset_;
    }

    modifier onlyPositionOwner(bytes32 positionId) {
        require(positions[positionId].owner == msg.sender, "not owner");
        _;
    }

    function configureProtection(
        bytes32 positionId,
        uint256 minHealthFactor,
        uint256 rescueAmount,
        uint256 cooldownBlocks
    ) external {
        PositionConfig storage config = positions[positionId];

        if (config.owner == address(0)) {
            config.owner = msg.sender;
        } else {
            require(config.owner == msg.sender, "owner mismatch");
        }

        config.minHealthFactor = minHealthFactor;
        config.rescueAmount = rescueAmount;
        config.cooldownBlocks = cooldownBlocks;
        config.active = true;

        emit ProtectionConfigured(
            positionId,
            msg.sender,
            minHealthFactor,
            rescueAmount,
            cooldownBlocks
        );
    }

    function depositReserve(bytes32 positionId, uint256 amount) external onlyPositionOwner(positionId) {
        PositionConfig storage config = positions[positionId];
        require(config.active, "inactive");

        require(asset.transferFrom(msg.sender, address(this), amount), "transfer failed");
        config.availableReserve += amount;

        emit ReserveUpdated(positionId, config.availableReserve, config.committedReserve);
    }

    function withdrawReserve(bytes32 positionId, uint256 amount) external onlyPositionOwner(positionId) {
        PositionConfig storage config = positions[positionId];
        require(config.availableReserve >= amount, "insufficient reserve");

        config.availableReserve -= amount;
        require(asset.transfer(msg.sender, amount), "transfer failed");

        emit ReserveUpdated(positionId, config.availableReserve, config.committedReserve);
    }

    function commitReserve(
        address reactiveSender,
        bytes32 positionId,
        uint256 amount
    ) external authorizedSenderOnly rvmIdOnly(reactiveSender) {
        PositionConfig storage config = positions[positionId];
        require(config.active, "inactive");
        require(config.availableReserve >= amount, "reserve too low");

        config.availableReserve -= amount;
        config.committedReserve += amount;

        emit ReserveCommitted(positionId, amount, reactiveSender);
        emit ReserveUpdated(positionId, config.availableReserve, config.committedReserve);
    }
}
