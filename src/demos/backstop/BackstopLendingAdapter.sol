// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "./MockLendingMarket.sol";

contract BackstopLendingAdapter {
    MockLendingMarket public immutable lendingMarket;

    event PositionOpened(
        bytes32 indexed positionId,
        address indexed owner,
        uint256 collateralValue,
        uint256 debtOutstanding
    );

    event HealthFactorUpdated(
        bytes32 indexed positionId,
        uint256 healthFactor,
        uint256 debtOutstanding
    );

    constructor(MockLendingMarket lendingMarket_) {
        lendingMarket = lendingMarket_;
    }

    function openPosition(
        bytes32 positionId,
        uint256 collateralValue,
        uint256 debtOutstanding
    ) external {
        lendingMarket.registerPositionFor(msg.sender, positionId, collateralValue, debtOutstanding);
        emit PositionOpened(positionId, msg.sender, collateralValue, debtOutstanding);
        _emitHealthFactor(positionId);
    }

    function updateCollateralValue(bytes32 positionId, uint256 collateralValue) external {
        (address owner,,) = lendingMarket.positions(positionId);
        require(owner == msg.sender, "not owner");

        lendingMarket.updateCollateralValue(positionId, collateralValue);
        _emitHealthFactor(positionId);
    }

    function syncPosition(bytes32 positionId) external {
        _emitHealthFactor(positionId);
    }

    function _emitHealthFactor(bytes32 positionId) internal {
        (, , uint256 debtOutstanding) = lendingMarket.positions(positionId);
        emit HealthFactorUpdated(positionId, lendingMarket.healthFactor(positionId), debtOutstanding);
    }
}
