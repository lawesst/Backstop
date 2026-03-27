// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../../lib/reactive-lib/src/abstract-base/AbstractCallback.sol";
import "./BackstopLendingAdapter.sol";
import "./MockUSDC.sol";
import "./MockLendingMarket.sol";

contract BackstopExecutor is AbstractCallback {
    MockUSDC public immutable debtAsset;
    MockLendingMarket public immutable lendingMarket;
    BackstopLendingAdapter public immutable lendingAdapter;

    event LiquidityFunded(address indexed funder, uint256 amount);
    event RescueExecuted(
        bytes32 indexed positionId,
        uint256 amount,
        address indexed reactiveSender
    );

    constructor(
        MockUSDC debtAsset_,
        MockLendingMarket lendingMarket_,
        BackstopLendingAdapter lendingAdapter_,
        address callbackSender_
    ) payable AbstractCallback(callbackSender_) {
        debtAsset = debtAsset_;
        lendingMarket = lendingMarket_;
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
        require(debtAsset.approve(address(lendingMarket), amount), "approve failed");
        lendingMarket.repayFromRescue(positionId, amount);
        lendingAdapter.syncPosition(positionId);
        emit RescueExecuted(positionId, amount, reactiveSender);
    }
}
