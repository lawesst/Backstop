// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../../lib/reactive-lib/src/abstract-base/AbstractCallback.sol";
import "./AaveV3BackstopAdapter.sol";
import "./AaveV3Interfaces.sol";
import "./IERC20Like.sol";

contract AaveV3BackstopExecutor is AbstractCallback {
    uint256 public constant VARIABLE_RATE_MODE = 2;

    IERC20Like public immutable debtAsset;
    IAaveV3Pool public immutable pool;
    AaveV3BackstopAdapter public immutable lendingAdapter;

    event LiquidityFunded(address indexed funder, uint256 amount);
    event RescueExecuted(
        bytes32 indexed positionId,
        address indexed user,
        uint256 amount,
        address indexed reactiveSender
    );

    constructor(
        IERC20Like debtAsset_,
        IAaveV3Pool pool_,
        AaveV3BackstopAdapter lendingAdapter_,
        address callbackSender_
    ) payable AbstractCallback(callbackSender_) {
        debtAsset = debtAsset_;
        pool = pool_;
        lendingAdapter = lendingAdapter_;
    }

    function fundLiquidity(uint256 amount) external {
        require(debtAsset.transferFrom(msg.sender, address(this), amount), "fund transfer failed");
        emit LiquidityFunded(msg.sender, amount);
    }

    function availableLiquidity() external view returns (uint256) {
        return debtAsset.balanceOf(address(this));
    }

    function executeRescue(
        address reactiveSender,
        bytes32 positionId,
        uint256 amount
    ) external authorizedSenderOnly rvmIdOnly(reactiveSender) {
        (address user, address positionDebtAsset,, bool active) = lendingAdapter.getPosition(positionId);

        require(active, "inactive");
        require(positionDebtAsset == address(debtAsset), "wrong asset");
        require(debtAsset.approve(address(pool), amount), "approve failed");

        uint256 repaid = pool.repay(address(debtAsset), amount, VARIABLE_RATE_MODE, user);
        require(repaid > 0, "repay failed");

        lendingAdapter.syncPosition(positionId);
        emit RescueExecuted(positionId, user, repaid, reactiveSender);
    }
}
