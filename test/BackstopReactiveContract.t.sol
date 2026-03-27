// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "forge-std/Test.sol";
import "../lib/reactive-lib/src/interfaces/IReactive.sol";

import "../src/backstop/BackstopExecutor.sol";
import "../src/backstop/BackstopLendingAdapter.sol";
import "../src/backstop/BackstopReactiveContract.sol";
import "../src/backstop/BackstopVault.sol";
import "../src/backstop/IERC20Like.sol";
import "../src/backstop/MockLendingMarket.sol";
import "../src/backstop/MockUSDC.sol";

contract MockSystemContract {
    struct Subscription {
        uint256 chainId;
        address source;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
        uint256 topic3;
    }

    Subscription[] public subscriptions;

    function subscribe(
        uint256 chainId,
        address source,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) external {
        subscriptions.push(Subscription(chainId, source, topic0, topic1, topic2, topic3));
    }

    function depositTo(address) external payable {
    }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function subscriptionCount() external view returns (uint256) {
        return subscriptions.length;
    }
}

contract BackstopReactiveContractTest is Test {
    uint256 internal constant RESERVE_CHAIN_ID = 11155111;
    uint256 internal constant DEBT_CHAIN_ID = 84532;
    address internal constant SYSTEM_ADDR = 0x0000000000000000000000000000000000fffFfF;
    uint64 internal constant CALLBACK_GAS_LIMIT = 300_000;
    uint256 internal constant MIN_HEALTH_FACTOR = 1.15e18;
    uint256 internal constant RESCUE_AMOUNT = 25_000_000;
    uint256 internal constant COOLDOWN_BLOCKS = 25;

    bytes32 internal constant POSITION_ID = keccak256("base:alice:position-1");

    address internal reactiveSender = makeAddr("reactiveSender");
    address internal callbackProxy = makeAddr("callbackProxy");
    address internal alice = makeAddr("alice");
    address internal liquidityProvider = makeAddr("lp");

    MockUSDC internal reserveAsset;
    MockUSDC internal debtAsset;
    BackstopVault internal reserveVault;
    MockLendingMarket internal lendingMarket;
    BackstopLendingAdapter internal lendingAdapter;
    BackstopExecutor internal executor;
    BackstopReactiveContract internal reactiveNetworkInstance;
    BackstopReactiveContract internal reactVmInstance;
    MockSystemContract internal mockSystemContract;
    uint256 internal subscriptionCountAfterNetworkDeploy;

    function setUp() public {
        vm.startPrank(reactiveSender);
        reserveAsset = new MockUSDC();
        debtAsset = new MockUSDC();

        reserveVault = new BackstopVault(IERC20Like(address(reserveAsset)), callbackProxy);
        lendingMarket = new MockLendingMarket(debtAsset);
        lendingAdapter = new BackstopLendingAdapter(lendingMarket);
        executor = new BackstopExecutor(
            debtAsset,
            lendingMarket,
            lendingAdapter,
            callbackProxy
        );
        lendingMarket.setRescueExecutor(address(executor));
        vm.stopPrank();

        mockSystemContract = new MockSystemContract();
        vm.etch(SYSTEM_ADDR, address(mockSystemContract).code);

        vm.startPrank(reactiveSender);
        reactiveNetworkInstance = new BackstopReactiveContract(
            RESERVE_CHAIN_ID,
            address(reserveVault),
            DEBT_CHAIN_ID,
            address(lendingAdapter),
            address(executor),
            CALLBACK_GAS_LIMIT
        );
        subscriptionCountAfterNetworkDeploy = MockSystemContract(SYSTEM_ADDR).subscriptionCount();
        vm.stopPrank();

        vm.etch(SYSTEM_ADDR, bytes(""));
        vm.startPrank(reactiveSender);
        reactVmInstance = new BackstopReactiveContract(
            RESERVE_CHAIN_ID,
            address(reserveVault),
            DEBT_CHAIN_ID,
            address(lendingAdapter),
            address(executor),
            CALLBACK_GAS_LIMIT
        );
        vm.stopPrank();

        reserveAsset.mint(alice, 100_000_000);
        debtAsset.mint(liquidityProvider, 100_000_000);

        vm.startPrank(alice);
        reserveVault.configureProtection(POSITION_ID, MIN_HEALTH_FACTOR, RESCUE_AMOUNT, COOLDOWN_BLOCKS);
        reserveAsset.approve(address(reserveVault), RESCUE_AMOUNT * 2);
        reserveVault.depositReserve(POSITION_ID, RESCUE_AMOUNT * 2);
        lendingAdapter.openPosition(POSITION_ID, 150_000_000, 100_000_000);
        vm.stopPrank();

        vm.startPrank(liquidityProvider);
        debtAsset.approve(address(executor), RESCUE_AMOUNT * 2);
        executor.fundLiquidity(RESCUE_AMOUNT * 2);
        vm.stopPrank();
    }

    function testConstructorRegistersStaticSubscriptions() public view {
        assertEq(subscriptionCountAfterNetworkDeploy, 3);
        assertFalse(reactiveNetworkInstance.isVm());
        assertTrue(reactVmInstance.isVm());
    }

    function testTriggersCrossChainRescueWhenHealthFallsBelowThreshold() public {
        _mirrorProtection();
        _mirrorReserveUpdate(RESCUE_AMOUNT * 2, 0);

        vm.prank(alice);
        lendingAdapter.updateCollateralValue(POSITION_ID, 90_000_000);

        uint256 riskHealthFactor = lendingMarket.healthFactor(POSITION_ID);
        assertLt(riskHealthFactor, MIN_HEALTH_FACTOR);

        vm.recordLogs();
        reactVmInstance.react(_logRecord(
            DEBT_CHAIN_ID,
            address(lendingAdapter),
            reactVmInstance.HEALTH_FACTOR_UPDATED_TOPIC_0(),
            uint256(POSITION_ID),
            abi.encode(riskHealthFactor, 100_000_000),
            200
        ));

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 3);

        assertEq(uint256(entries[0].topics[0]), uint256(keccak256("RescueTriggered(bytes32,uint256,uint256,uint256)")));
        assertEq(uint256(entries[1].topics[0]), uint256(keccak256("Callback(uint256,address,uint64,bytes)")));
        assertEq(uint256(entries[2].topics[0]), uint256(keccak256("Callback(uint256,address,uint64,bytes)")));

        (
            uint256 minHealthFactor,
            uint256 rescueAmount,
            uint256 cooldownBlocks,
            uint256 availableReserve,
            uint256 committedReserve,
            uint256 lastRescueBlock,
            bool active
        ) = reactVmInstance.protections(POSITION_ID);

        assertEq(minHealthFactor, MIN_HEALTH_FACTOR);
        assertEq(rescueAmount, RESCUE_AMOUNT);
        assertEq(cooldownBlocks, COOLDOWN_BLOCKS);
        assertEq(availableReserve, RESCUE_AMOUNT);
        assertEq(committedReserve, RESCUE_AMOUNT);
        assertEq(lastRescueBlock, 200);
        assertTrue(active);

        vm.startPrank(callbackProxy);
        reserveVault.commitReserve(reactiveSender, POSITION_ID, RESCUE_AMOUNT);
        executor.executeRescue(reactiveSender, POSITION_ID, RESCUE_AMOUNT);
        vm.stopPrank();

        (
            ,
            uint256 availableAfterCommit,
            uint256 committedAfterCommit,
            ,
            ,
            ,
            bool activeAfterCommit
        ) = reserveVault.positions(POSITION_ID);

        assertEq(availableAfterCommit, RESCUE_AMOUNT);
        assertEq(committedAfterCommit, RESCUE_AMOUNT);
        assertTrue(activeAfterCommit);

        assertEq(debtAsset.balanceOf(address(executor)), RESCUE_AMOUNT);

        (, , uint256 debtOutstandingAfterRescue) = lendingMarket.positions(POSITION_ID);
        assertEq(debtOutstandingAfterRescue, 75_000_000);
        assertEq(lendingMarket.healthFactor(POSITION_ID), 1.2e18);
    }

    function testSkipsRescueWhenReserveIsInsufficient() public {
        _mirrorProtection();
        _mirrorReserveUpdate(10_000_000, 0);

        vm.prank(alice);
        lendingAdapter.updateCollateralValue(POSITION_ID, 90_000_000);

        uint256 riskHealthFactor = lendingMarket.healthFactor(POSITION_ID);

        vm.recordLogs();
        reactVmInstance.react(_logRecord(
            DEBT_CHAIN_ID,
            address(lendingAdapter),
            reactVmInstance.HEALTH_FACTOR_UPDATED_TOPIC_0(),
            uint256(POSITION_ID),
            abi.encode(riskHealthFactor, 100_000_000),
            210
        ));

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 1);
        assertEq(uint256(entries[0].topics[0]), uint256(keccak256("RescueSkipped(bytes32,uint8,uint256,uint256)")));

        (
            ,
            ,
            ,
            uint256 availableReserve,
            uint256 committedReserve,
            uint256 lastRescueBlock,
            bool active
        ) = reactVmInstance.protections(POSITION_ID);

        assertEq(availableReserve, 10_000_000);
        assertEq(committedReserve, 0);
        assertEq(lastRescueBlock, 0);
        assertTrue(active);
    }

    function _mirrorProtection() internal {
        reactVmInstance.react(_logRecord(
            RESERVE_CHAIN_ID,
            address(reserveVault),
            reactVmInstance.PROTECTION_CONFIGURED_TOPIC_0(),
            uint256(POSITION_ID),
            abi.encode(MIN_HEALTH_FACTOR, RESCUE_AMOUNT, COOLDOWN_BLOCKS),
            100
        ));
    }

    function _mirrorReserveUpdate(uint256 availableReserve, uint256 committedReserve) internal {
        reactVmInstance.react(_logRecord(
            RESERVE_CHAIN_ID,
            address(reserveVault),
            reactVmInstance.RESERVE_UPDATED_TOPIC_0(),
            uint256(POSITION_ID),
            abi.encode(availableReserve, committedReserve),
            101
        ));
    }

    function _logRecord(
        uint256 chainId,
        address source,
        uint256 topic0,
        uint256 topic1,
        bytes memory data,
        uint256 blockNumber
    ) internal pure returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: chainId,
            _contract: source,
            topic_0: topic0,
            topic_1: topic1,
            topic_2: 0,
            topic_3: 0,
            data: data,
            block_number: blockNumber,
            op_code: 2,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}
