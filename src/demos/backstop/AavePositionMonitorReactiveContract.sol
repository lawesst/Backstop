// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "../../../lib/reactive-lib/src/abstract-base/AbstractReactive.sol";
import "../../../lib/reactive-lib/src/interfaces/IReactive.sol";

contract AavePositionMonitorReactiveContract is IReactive, AbstractReactive {
    uint256 public constant SUPPLY_TOPIC_0 =
        uint256(keccak256("Supply(address,address,address,uint256,uint16)"));
    uint256 public constant WITHDRAW_TOPIC_0 =
        uint256(keccak256("Withdraw(address,address,address,uint256)"));
    uint256 public constant BORROW_TOPIC_0 =
        uint256(keccak256("Borrow(address,address,address,uint256,uint8,uint256,uint16)"));
    uint256 public constant REPAY_TOPIC_0 =
        uint256(keccak256("Repay(address,address,address,uint256,bool)"));
    uint256 public constant LIQUIDATION_CALL_TOPIC_0 =
        uint256(keccak256("LiquidationCall(address,address,address,uint256,uint256,address,bool)"));
    uint256 public constant COLLATERAL_ENABLED_TOPIC_0 =
        uint256(keccak256("ReserveUsedAsCollateralEnabled(address,address)"));
    uint256 public constant COLLATERAL_DISABLED_TOPIC_0 =
        uint256(keccak256("ReserveUsedAsCollateralDisabled(address,address)"));
    uint256 public constant USER_EMODE_SET_TOPIC_0 =
        uint256(keccak256("UserEModeSet(address,uint8)"));

    uint256 public immutable debtChainId;
    address public immutable lendingPool;
    address public immutable syncAdapter;
    uint64 public immutable callbackGasLimit;

    mapping(address => bool) public watchedAccounts;

    event AccountWatched(address indexed account);
    event AccountUnwatched(address indexed account);
    event PositionSyncRequested(address indexed account, uint256 indexed triggerTopic0);

    constructor(
        uint256 debtChainId_,
        address lendingPool_,
        address syncAdapter_,
        uint64 callbackGasLimit_
    ) payable {
        debtChainId = debtChainId_;
        lendingPool = lendingPool_;
        syncAdapter = syncAdapter_;
        callbackGasLimit = callbackGasLimit_;
    }

    function watchAccount(address account) external rnOnly {
        require(account != address(0), "account required");
        require(!watchedAccounts[account], "already watched");

        watchedAccounts[account] = true;

        _subscribe(account, SUPPLY_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _subscribe(account, WITHDRAW_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        // Aave borrow logs can surface the user in topic_2 and the onBehalfOf account in topic_3.
        // Subscribe to both so delegated borrows and direct borrows both trigger a sync.
        _subscribe(account, BORROW_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _subscribe(account, BORROW_TOPIC_0, REACTIVE_IGNORE, REACTIVE_IGNORE, uint256(uint160(account)));
        _subscribe(account, REPAY_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _subscribe(account, LIQUIDATION_CALL_TOPIC_0, REACTIVE_IGNORE, REACTIVE_IGNORE, uint256(uint160(account)));
        _subscribe(account, COLLATERAL_ENABLED_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _subscribe(account, COLLATERAL_DISABLED_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _subscribe(account, USER_EMODE_SET_TOPIC_0, uint256(uint160(account)), REACTIVE_IGNORE, REACTIVE_IGNORE);

        emit AccountWatched(account);
    }

    function unwatchAccount(address account) external rnOnly {
        require(watchedAccounts[account], "not watched");

        watchedAccounts[account] = false;

        _unsubscribe(account, SUPPLY_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, WITHDRAW_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, BORROW_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, BORROW_TOPIC_0, REACTIVE_IGNORE, REACTIVE_IGNORE, uint256(uint160(account)));
        _unsubscribe(account, REPAY_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, LIQUIDATION_CALL_TOPIC_0, REACTIVE_IGNORE, REACTIVE_IGNORE, uint256(uint160(account)));
        _unsubscribe(account, COLLATERAL_ENABLED_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, COLLATERAL_DISABLED_TOPIC_0, REACTIVE_IGNORE, uint256(uint160(account)), REACTIVE_IGNORE);
        _unsubscribe(account, USER_EMODE_SET_TOPIC_0, uint256(uint160(account)), REACTIVE_IGNORE, REACTIVE_IGNORE);

        emit AccountUnwatched(account);
    }

    function react(LogRecord calldata log) external override vmOnly {
        if (log.chain_id != debtChainId || log._contract != lendingPool) {
            return;
        }

        address account = _accountFromLog(log);
        if (account == address(0)) {
            return;
        }

        emit PositionSyncRequested(account, log.topic_0);

        bytes memory payload = abi.encodeWithSignature(
            "syncAccountFromReactive(address,address)",
            address(0),
            account
        );
        emit Callback(debtChainId, syncAdapter, callbackGasLimit, payload);
    }

    function isVm() external view returns (bool) {
        return vm;
    }

    function _accountFromLog(LogRecord calldata log) private pure returns (address) {
        if (log.topic_0 == SUPPLY_TOPIC_0 || log.topic_0 == LIQUIDATION_CALL_TOPIC_0) {
            return address(uint160(log.topic_3));
        }

        if (log.topic_0 == BORROW_TOPIC_0) {
            address topic2Account = address(uint160(log.topic_2));
            if (topic2Account != address(0)) {
                return topic2Account;
            }
            return address(uint160(log.topic_3));
        }

        if (
            log.topic_0 == WITHDRAW_TOPIC_0 ||
            log.topic_0 == REPAY_TOPIC_0 ||
            log.topic_0 == COLLATERAL_ENABLED_TOPIC_0 ||
            log.topic_0 == COLLATERAL_DISABLED_TOPIC_0
        ) {
            return address(uint160(log.topic_2));
        }

        if (log.topic_0 == USER_EMODE_SET_TOPIC_0) {
            return address(uint160(log.topic_1));
        }

        return address(0);
    }

    function _subscribe(
        address,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) private {
        service.subscribe(debtChainId, lendingPool, topic0, topic1, topic2, topic3);
    }

    function _unsubscribe(
        address,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) private {
        service.unsubscribe(debtChainId, lendingPool, topic0, topic1, topic2, topic3);
    }
}
