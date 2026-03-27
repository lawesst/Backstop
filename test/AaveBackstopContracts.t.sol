// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "forge-std/Test.sol";

import "../lib/reactive-lib/src/interfaces/IReactive.sol";
import "../src/backstop/AavePositionMonitorReactiveContract.sol";
import "../src/backstop/AaveV3BackstopAdapter.sol";
import "../src/backstop/AaveV3BackstopExecutor.sol";
import "../src/backstop/IERC20Like.sol";
import "../src/backstop/MockUSDC.sol";

contract MockSystemContractAave {
    struct Subscription {
        uint256 chainId;
        address source;
        uint256 topic0;
        uint256 topic1;
        uint256 topic2;
        uint256 topic3;
    }

    Subscription[] public subscriptions;
    Subscription[] public unsubscriptions;

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

    function unsubscribe(
        uint256 chainId,
        address source,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) external {
        unsubscriptions.push(Subscription(chainId, source, topic0, topic1, topic2, topic3));
    }

    function depositTo(address) external payable {
    }

    function debt(address) external pure returns (uint256) {
        return 0;
    }

    function subscriptionCount() external view returns (uint256) {
        return subscriptions.length;
    }

    function unsubscriptionCount() external view returns (uint256) {
        return unsubscriptions.length;
    }
}

contract MockVariableDebtToken {
    mapping(address => uint256) public balanceOf;

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }

    function burn(address account, uint256 amount) external {
        uint256 currentBalance = balanceOf[account];
        require(currentBalance >= amount, "burn exceeds balance");
        balanceOf[account] = currentBalance - amount;
    }
}

contract MockAaveV3Pool {
    mapping(address => uint256) public healthFactorByUser;
    mapping(address => address) public variableDebtTokenByAsset;
    mapping(address => uint256) public totalDebtBaseByUser;

    function setHealthFactor(address user, uint256 healthFactor) external {
        healthFactorByUser[user] = healthFactor;
    }

    function setDebtBase(address user, uint256 totalDebtBase) external {
        totalDebtBaseByUser[user] = totalDebtBase;
    }

    function setVariableDebtToken(address asset, address variableDebtToken) external {
        variableDebtTokenByAsset[asset] = variableDebtToken;
    }

    function getUserAccountData(address user)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return (0, totalDebtBaseByUser[user], 0, 0, 0, healthFactorByUser[user]);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256,
        address onBehalfOf
    ) external returns (uint256) {
        require(IERC20Like(asset).transferFrom(msg.sender, address(this), amount), "transfer failed");

        address variableDebtToken = variableDebtTokenByAsset[asset];
        MockVariableDebtToken(variableDebtToken).burn(onBehalfOf, amount);
        totalDebtBaseByUser[onBehalfOf] -= amount;
        healthFactorByUser[onBehalfOf] = 1.2e18;

        return amount;
    }
}

contract AaveBackstopContractsTest is Test {
    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
    address internal constant SYSTEM_ADDR = 0x0000000000000000000000000000000000fffFfF;

    bytes32 internal constant POSITION_ID = keccak256("aave:alice:position-1");

    address internal reactiveSender = makeAddr("reactiveSender");
    address internal callbackProxy = makeAddr("callbackProxy");
    address internal alice = makeAddr("alice");
    address internal liquidityProvider = makeAddr("lp");

    MockSystemContractAave internal mockSystemContract;
    MockAaveV3Pool internal mockPool;
    MockUSDC internal debtAsset;
    MockVariableDebtToken internal variableDebtToken;
    AaveV3BackstopAdapter internal adapter;
    AaveV3BackstopExecutor internal executor;
    AavePositionMonitorReactiveContract internal networkMonitor;
    AavePositionMonitorReactiveContract internal vmMonitor;

    function setUp() public {
        mockPool = new MockAaveV3Pool();
        debtAsset = new MockUSDC();
        variableDebtToken = new MockVariableDebtToken();

        vm.startPrank(reactiveSender);
        adapter = new AaveV3BackstopAdapter(
            IAaveV3Pool(address(mockPool)),
            callbackProxy
        );
        executor = new AaveV3BackstopExecutor(
            IERC20Like(address(debtAsset)),
            IAaveV3Pool(address(mockPool)),
            adapter,
            callbackProxy
        );
        vm.stopPrank();

        mockPool.setVariableDebtToken(address(debtAsset), address(variableDebtToken));
        mockPool.setHealthFactor(alice, 0.9e18);
        mockPool.setDebtBase(alice, 100_000_000);
        variableDebtToken.setBalance(alice, 100_000_000);

        vm.prank(alice);
        adapter.configurePosition(POSITION_ID, alice, address(debtAsset), address(variableDebtToken));

        debtAsset.mint(liquidityProvider, 50_000_000);
        vm.startPrank(liquidityProvider);
        debtAsset.approve(address(executor), 25_000_000);
        executor.fundLiquidity(25_000_000);
        vm.stopPrank();

        mockSystemContract = new MockSystemContractAave();
        vm.etch(SYSTEM_ADDR, address(mockSystemContract).code);

        vm.startPrank(reactiveSender);
        networkMonitor = new AavePositionMonitorReactiveContract(
            SEPOLIA_CHAIN_ID,
            makeAddr("aavePool"),
            address(adapter),
            300_000
        );
        vm.stopPrank();

        vm.etch(SYSTEM_ADDR, bytes(""));
        vm.startPrank(reactiveSender);
        vmMonitor = new AavePositionMonitorReactiveContract(
            SEPOLIA_CHAIN_ID,
            makeAddr("aavePool"),
            address(adapter),
            300_000
        );
        vm.stopPrank();

        vm.etch(SYSTEM_ADDR, address(mockSystemContract).code);
    }

    function testWatchAccountRegistersAaveSubscriptions() public {
        vm.prank(reactiveSender);
        networkMonitor.watchAccount(alice);

        assertEq(MockSystemContractAave(SYSTEM_ADDR).subscriptionCount(), 9);
        assertFalse(networkMonitor.isVm());
        assertTrue(vmMonitor.isVm());
    }

    function testAaveEventRequestsAccountSyncCallback() public {
        vm.recordLogs();
        vmMonitor.react(_logRecord(
            SEPOLIA_CHAIN_ID,
            vmMonitor.lendingPool(),
            vmMonitor.BORROW_TOPIC_0(),
            0,
            uint256(uint160(alice)),
            0
        ));

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 2);
        assertEq(
            uint256(entries[0].topics[0]),
            uint256(keccak256("PositionSyncRequested(address,uint256)"))
        );
        assertEq(
            uint256(entries[1].topics[0]),
            uint256(keccak256("Callback(uint256,address,uint64,bytes)"))
        );
    }

    function testExecutorRepaysAaveDebtAndResyncsPosition() public {
        vm.prank(callbackProxy);
        executor.executeRescue(reactiveSender, POSITION_ID, 25_000_000);

        assertEq(debtAsset.balanceOf(address(mockPool)), 25_000_000);
        assertEq(variableDebtToken.balanceOf(alice), 75_000_000);
        assertEq(mockPool.healthFactorByUser(alice), 1.2e18);
    }

    function _logRecord(
        uint256 chainId,
        address source,
        uint256 topic0,
        uint256 topic1,
        uint256 topic2,
        uint256 topic3
    ) internal pure returns (IReactive.LogRecord memory) {
        return IReactive.LogRecord({
            chain_id: chainId,
            _contract: source,
            topic_0: topic0,
            topic_1: topic1,
            topic_2: topic2,
            topic_3: topic3,
            data: "",
            block_number: 0,
            op_code: 2,
            block_hash: 0,
            tx_hash: 0,
            log_index: 0
        });
    }
}
