// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../../lib/reactive-lib/src/abstract-base/AbstractReactive.sol";
import "../../../lib/reactive-lib/src/interfaces/IReactive.sol";

contract BackstopReactiveContract is IReactive, AbstractReactive {
    struct ProtectionState {
        uint256 minHealthFactor;
        uint256 rescueAmount;
        uint256 cooldownBlocks;
        uint256 availableReserve;
        uint256 committedReserve;
        uint256 lastRescueBlock;
        bool active;
    }

    uint256 public constant PROTECTION_CONFIGURED_TOPIC_0 =
        uint256(keccak256("ProtectionConfigured(bytes32,address,uint256,uint256,uint256)"));
    uint256 public constant RESERVE_UPDATED_TOPIC_0 =
        uint256(keccak256("ReserveUpdated(bytes32,uint256,uint256)"));
    uint256 public constant HEALTH_FACTOR_UPDATED_TOPIC_0 =
        uint256(keccak256("HealthFactorUpdated(bytes32,uint256,uint256)"));

    uint256 public immutable reserveChainId;
    uint256 public immutable debtChainId;
    address public immutable reserveVault;
    address public immutable lendingAdapter;
    address public immutable rescueExecutor;
    uint64 public immutable callbackGasLimit;

    mapping(bytes32 => ProtectionState) public protections;

    event ProtectionMirrored(
        bytes32 indexed positionId,
        uint256 minHealthFactor,
        uint256 rescueAmount,
        uint256 cooldownBlocks
    );

    event ReserveMirrored(
        bytes32 indexed positionId,
        uint256 availableReserve,
        uint256 committedReserve
    );

    event RescueTriggered(
        bytes32 indexed positionId,
        uint256 observedHealthFactor,
        uint256 repayAmount,
        uint256 reserveRemaining
    );

    event RescueSkipped(
        bytes32 indexed positionId,
        uint8 reason,
        uint256 observedHealthFactor,
        uint256 availableReserve
    );

    constructor(
        uint256 reserveChainId_,
        address reserveVault_,
        uint256 debtChainId_,
        address lendingAdapter_,
        address rescueExecutor_,
        uint64 callbackGasLimit_
    ) payable {
        reserveChainId = reserveChainId_;
        debtChainId = debtChainId_;
        reserveVault = reserveVault_;
        lendingAdapter = lendingAdapter_;
        rescueExecutor = rescueExecutor_;
        callbackGasLimit = callbackGasLimit_;

        if (!vm) {
            service.subscribe(
                reserveChainId_,
                reserveVault_,
                PROTECTION_CONFIGURED_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );

            service.subscribe(
                reserveChainId_,
                reserveVault_,
                RESERVE_UPDATED_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );

            service.subscribe(
                debtChainId_,
                lendingAdapter_,
                HEALTH_FACTOR_UPDATED_TOPIC_0,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );
        }
    }

    function react(LogRecord calldata log) external override vmOnly {
        bytes32 positionId = bytes32(log.topic_1);

        if (log.chain_id == reserveChainId && log._contract == reserveVault) {
            if (log.topic_0 == PROTECTION_CONFIGURED_TOPIC_0) {
                _handleProtectionConfigured(positionId, log.data);
            } else if (log.topic_0 == RESERVE_UPDATED_TOPIC_0) {
                _handleReserveUpdated(positionId, log.data);
            }
            return;
        }

        if (log.chain_id == debtChainId && log._contract == lendingAdapter && log.topic_0 == HEALTH_FACTOR_UPDATED_TOPIC_0) {
            _handleHealthFactorUpdated(positionId, log.data, log.block_number);
        }
    }

    function isVm() external view returns (bool) {
        return vm;
    }

    function _handleProtectionConfigured(bytes32 positionId, bytes calldata data) private {
        (uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks) =
            abi.decode(data, (uint256, uint256, uint256));

        ProtectionState storage protection = protections[positionId];
        protection.minHealthFactor = minHealthFactor;
        protection.rescueAmount = rescueAmount;
        protection.cooldownBlocks = cooldownBlocks;
        protection.active = true;

        emit ProtectionMirrored(positionId, minHealthFactor, rescueAmount, cooldownBlocks);
    }

    function _handleReserveUpdated(bytes32 positionId, bytes calldata data) private {
        (uint256 availableReserve, uint256 committedReserve) = abi.decode(data, (uint256, uint256));

        ProtectionState storage protection = protections[positionId];
        protection.availableReserve = availableReserve;
        protection.committedReserve = committedReserve;

        emit ReserveMirrored(positionId, availableReserve, committedReserve);
    }

    function _handleHealthFactorUpdated(
        bytes32 positionId,
        bytes calldata data,
        uint256 blockNumber
    ) private {
        (uint256 healthFactor, uint256 debtOutstanding) = abi.decode(data, (uint256, uint256));
        ProtectionState storage protection = protections[positionId];

        if (!protection.active) {
            emit RescueSkipped(positionId, 0, healthFactor, protection.availableReserve);
            return;
        }

        if (healthFactor > protection.minHealthFactor) {
            emit RescueSkipped(positionId, 1, healthFactor, protection.availableReserve);
            return;
        }

        if (protection.availableReserve == 0 || protection.availableReserve < protection.rescueAmount) {
            emit RescueSkipped(positionId, 2, healthFactor, protection.availableReserve);
            return;
        }

        if (
            protection.cooldownBlocks > 0 &&
            protection.lastRescueBlock > 0 &&
            blockNumber < protection.lastRescueBlock + protection.cooldownBlocks
        ) {
            emit RescueSkipped(positionId, 3, healthFactor, protection.availableReserve);
            return;
        }

        uint256 repayAmount = protection.rescueAmount;
        if (repayAmount > debtOutstanding) {
            repayAmount = debtOutstanding;
        }

        if (repayAmount == 0) {
            emit RescueSkipped(positionId, 4, healthFactor, protection.availableReserve);
            return;
        }

        protection.availableReserve -= repayAmount;
        protection.committedReserve += repayAmount;
        protection.lastRescueBlock = blockNumber;

        emit RescueTriggered(positionId, healthFactor, repayAmount, protection.availableReserve);

        bytes memory reservePayload = abi.encodeWithSignature(
            "commitReserve(address,bytes32,uint256)",
            address(0),
            positionId,
            repayAmount
        );
        emit Callback(reserveChainId, reserveVault, callbackGasLimit, reservePayload);

        bytes memory rescuePayload = abi.encodeWithSignature(
            "executeRescue(address,bytes32,uint256)",
            address(0),
            positionId,
            repayAmount
        );
        emit Callback(debtChainId, rescueExecutor, callbackGasLimit, rescuePayload);
    }
}
