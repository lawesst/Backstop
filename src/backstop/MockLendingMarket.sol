// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "./MockUSDC.sol";

contract MockLendingMarket {
    struct Position {
        address owner;
        uint256 collateralValue;
        uint256 debtOutstanding;
    }

    MockUSDC public immutable debtAsset;
    address public rescueExecutor;

    mapping(bytes32 => Position) public positions;

    event PositionRegistered(
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

    event RescueApplied(
        bytes32 indexed positionId,
        uint256 repayAmount,
        uint256 newDebtOutstanding,
        uint256 newHealthFactor,
        address indexed executor
    );

    constructor(MockUSDC debtAsset_) {
        debtAsset = debtAsset_;
    }

    modifier onlyRescueExecutor() {
        require(msg.sender == rescueExecutor, "not executor");
        _;
    }

    function setRescueExecutor(address rescueExecutor_) external {
        require(rescueExecutor == address(0) || msg.sender == rescueExecutor, "executor locked");
        rescueExecutor = rescueExecutor_;
    }

    function registerPosition(
        bytes32 positionId,
        uint256 collateralValue,
        uint256 debtOutstanding
    ) external {
        registerPositionFor(msg.sender, positionId, collateralValue, debtOutstanding);
    }

    function registerPositionFor(
        address owner,
        bytes32 positionId,
        uint256 collateralValue,
        uint256 debtOutstanding
    ) public {
        require(positions[positionId].owner == address(0), "exists");
        require(debtOutstanding > 0, "zero debt");

        positions[positionId] = Position({
            owner: owner,
            collateralValue: collateralValue,
            debtOutstanding: debtOutstanding
        });

        emit PositionRegistered(positionId, owner, collateralValue, debtOutstanding);
        emit HealthFactorUpdated(positionId, healthFactor(positionId), debtOutstanding);
    }

    function updateCollateralValue(bytes32 positionId, uint256 collateralValue) external {
        Position storage position = positions[positionId];
        require(position.owner != address(0), "missing");

        position.collateralValue = collateralValue;
        emit HealthFactorUpdated(positionId, healthFactor(positionId), position.debtOutstanding);
    }

    function healthFactor(bytes32 positionId) public view returns (uint256) {
        Position storage position = positions[positionId];

        if (position.debtOutstanding == 0) {
            return type(uint256).max;
        }

        return (position.collateralValue * 1e18) / position.debtOutstanding;
    }

    function repayFromRescue(bytes32 positionId, uint256 amount) external onlyRescueExecutor {
        Position storage position = positions[positionId];
        require(position.owner != address(0), "missing");
        require(amount > 0, "zero amount");
        require(position.debtOutstanding >= amount, "too much");

        require(debtAsset.transferFrom(msg.sender, address(this), amount), "repay transfer failed");
        position.debtOutstanding -= amount;

        uint256 newHealthFactor = healthFactor(positionId);
        emit RescueApplied(positionId, amount, position.debtOutstanding, newHealthFactor, msg.sender);
        emit HealthFactorUpdated(positionId, newHealthFactor, position.debtOutstanding);
    }
}
