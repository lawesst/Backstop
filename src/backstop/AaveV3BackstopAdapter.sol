// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../lib/reactive-lib/src/abstract-base/AbstractCallback.sol";
import "./AaveV3Interfaces.sol";
import "./IERC20Like.sol";

contract AaveV3BackstopAdapter is AbstractCallback {
    struct PositionConfig {
        address user;
        address debtAsset;
        address variableDebtToken;
        bool active;
    }

    IAaveV3Pool public immutable pool;

    mapping(bytes32 => PositionConfig) public positions;
    mapping(address => bytes32) public positionIdsByUser;

    event PositionConfigured(
        bytes32 indexed positionId,
        address indexed user,
        address indexed debtAsset,
        address variableDebtToken
    );

    event HealthFactorUpdated(
        bytes32 indexed positionId,
        uint256 healthFactor,
        uint256 debtOutstanding
    );

    constructor(IAaveV3Pool pool_, address callbackSender_) payable AbstractCallback(callbackSender_) {
        pool = pool_;
    }

    function configurePosition(
        bytes32 positionId,
        address user,
        address debtAsset,
        address variableDebtToken
    ) external {
        require(user == msg.sender, "user mismatch");
        require(debtAsset != address(0), "debt asset required");
        require(variableDebtToken != address(0), "debt token required");

        bytes32 currentPositionId = positionIdsByUser[user];
        require(currentPositionId == bytes32(0) || currentPositionId == positionId, "user already tracked");

        positions[positionId] = PositionConfig({
            user: user,
            debtAsset: debtAsset,
            variableDebtToken: variableDebtToken,
            active: true
        });
        positionIdsByUser[user] = positionId;

        emit PositionConfigured(positionId, user, debtAsset, variableDebtToken);
        _emitHealthFactor(positionId);
    }

    function syncPosition(bytes32 positionId) public {
        _emitHealthFactor(positionId);
    }

    function syncAccountFromReactive(
        address reactiveSender,
        address user
    ) external authorizedSenderOnly rvmIdOnly(reactiveSender) {
        bytes32 positionId = positionIdsByUser[user];
        require(positionId != bytes32(0), "unknown account");
        _emitHealthFactor(positionId);
    }

    function getPosition(bytes32 positionId)
        external
        view
        returns (address user, address debtAsset, address variableDebtToken, bool active)
    {
        PositionConfig memory position = positions[positionId];
        return (position.user, position.debtAsset, position.variableDebtToken, position.active);
    }

    function _emitHealthFactor(bytes32 positionId) internal {
        PositionConfig memory position = positions[positionId];
        require(position.active, "inactive");

        (, , , , , uint256 healthFactor) = pool.getUserAccountData(position.user);
        uint256 debtOutstanding = IERC20Like(position.variableDebtToken).balanceOf(position.user);

        emit HealthFactorUpdated(positionId, healthFactor, debtOutstanding);
    }
}
