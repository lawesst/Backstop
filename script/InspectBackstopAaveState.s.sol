// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../lib/reactive-lib/src/interfaces/IPayable.sol";
import "../src/backstop/AavePositionMonitorReactiveContract.sol";
import "../src/backstop/AaveV3BackstopAdapter.sol";
import "../src/backstop/AaveV3Interfaces.sol";
import "../src/backstop/BackstopReactiveContract.sol";
import "../src/backstop/BackstopVault.sol";
import "../src/backstop/IERC20Like.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract InspectBackstopAaveState is BackstopScriptBase {
    uint8 internal constant REASON_INACTIVE = 0;
    uint8 internal constant REASON_HEALTHY = 1;
    uint8 internal constant REASON_RESERVE_TOO_LOW = 2;
    uint8 internal constant REASON_COOLDOWN_ACTIVE = 3;
    uint8 internal constant REASON_ZERO_REPAY = 4;
    uint8 internal constant REASON_TRIGGER_READY = 5;

    struct SepoliaSnapshot {
        uint256 blockNumber;
        address vaultOwner;
        uint256 vaultAvailableReserve;
        uint256 vaultCommittedReserve;
        uint256 vaultMinHealthFactor;
        uint256 vaultRescueAmount;
        uint256 vaultCooldownBlocks;
        bool vaultActive;
        address trackedUser;
        address debtAsset;
        address variableDebtToken;
        bool adapterActive;
        uint256 healthFactor;
        uint256 debtOutstanding;
        uint256 executorLiquidity;
        uint256 ownerUsdcBalance;
        uint256 ownerVaultAllowance;
    }

    struct LasnaSnapshot {
        uint256 blockNumber;
        uint64 callbackGasLimit;
        address reserveVault;
        address lendingAdapter;
        address rescueExecutor;
        bool watchedAccount;
        uint256 backstopBalance;
        uint256 backstopDebt;
        uint256 monitorBalance;
        uint256 monitorDebt;
        uint256 topLevelMinHealthFactor;
        uint256 topLevelRescueAmount;
        uint256 topLevelCooldownBlocks;
        uint256 topLevelAvailableReserve;
        uint256 topLevelCommittedReserve;
        uint256 topLevelLastRescueBlock;
        bool topLevelActive;
    }

    function run() external {
        string memory sepoliaRpc = vm.envString("SEPOLIA_RPC");
        string memory reactiveRpc = vm.envString("REACTIVE_RPC");

        address owner = _loadPositionOwner();
        bytes32 positionId = _positionId(owner);

        uint256 sepoliaFork = vm.createFork(sepoliaRpc);
        uint256 lasnaFork = vm.createFork(reactiveRpc);

        SepoliaSnapshot memory sepolia = _loadSepoliaSnapshot(positionId, owner, sepoliaFork);
        LasnaSnapshot memory lasna = _loadLasnaSnapshot(positionId, owner, lasnaFork);

        (
            uint8 decision,
            uint256 repayAmount,
            uint256 reserveAfter,
            uint256 committedAfter
        ) = _previewExpectedRescue(
            sepolia.vaultMinHealthFactor,
            sepolia.vaultRescueAmount,
            sepolia.vaultCooldownBlocks,
            sepolia.vaultAvailableReserve,
            sepolia.vaultCommittedReserve,
            lasna.topLevelLastRescueBlock,
            sepolia.vaultActive,
            sepolia.healthFactor,
            sepolia.debtOutstanding,
            lasna.blockNumber
        );

        console2.log("Backstop live Aave inspection");
        console2.log("positionOwner");
        console2.logAddress(owner);
        console2.log("positionId");
        console2.logBytes32(positionId);

        console2.log("--- Sepolia ---");
        console2.log("sepoliaBlock");
        console2.logUint(sepolia.blockNumber);
        console2.log("vaultOwner");
        console2.logAddress(sepolia.vaultOwner);
        console2.log("vaultAvailableReserve");
        console2.logUint(sepolia.vaultAvailableReserve);
        console2.log("vaultCommittedReserve");
        console2.logUint(sepolia.vaultCommittedReserve);
        console2.log("vaultMinHealthFactor");
        console2.logUint(sepolia.vaultMinHealthFactor);
        console2.log("vaultRescueAmount");
        console2.logUint(sepolia.vaultRescueAmount);
        console2.log("vaultCooldownBlocks");
        console2.logUint(sepolia.vaultCooldownBlocks);
        console2.log("vaultActive");
        console2.log(sepolia.vaultActive);
        console2.log("trackedUser");
        console2.logAddress(sepolia.trackedUser);
        console2.log("debtAsset");
        console2.logAddress(sepolia.debtAsset);
        console2.log("variableDebtToken");
        console2.logAddress(sepolia.variableDebtToken);
        console2.log("adapterActive");
        console2.log(sepolia.adapterActive);
        console2.log("liveHealthFactor");
        console2.logUint(sepolia.healthFactor);
        console2.log("liveDebtOutstanding");
        console2.logUint(sepolia.debtOutstanding);
        console2.log("executorLiquidity");
        console2.logUint(sepolia.executorLiquidity);
        console2.log("ownerUsdcBalance");
        console2.logUint(sepolia.ownerUsdcBalance);
        console2.log("ownerVaultAllowance");
        console2.logUint(sepolia.ownerVaultAllowance);

        console2.log("--- Lasna Top Level ---");
        console2.log("lasnaBlock");
        console2.logUint(lasna.blockNumber);
        console2.log("reserveVault");
        console2.logAddress(lasna.reserveVault);
        console2.log("lendingAdapter");
        console2.logAddress(lasna.lendingAdapter);
        console2.log("rescueExecutor");
        console2.logAddress(lasna.rescueExecutor);
        console2.log("callbackGasLimit");
        console2.logUint(lasna.callbackGasLimit);
        console2.log("monitorWatchedAccount");
        console2.log(lasna.watchedAccount);
        console2.log("backstopBalance");
        console2.logUint(lasna.backstopBalance);
        console2.log("backstopDebt");
        console2.logUint(lasna.backstopDebt);
        console2.log("monitorBalance");
        console2.logUint(lasna.monitorBalance);
        console2.log("monitorDebt");
        console2.logUint(lasna.monitorDebt);

        console2.log("--- ReactVM Note ---");
        console2.log(
            "Top-level Lasna storage is not the ReactVM mirror. Zero values below do not prove the mirror failed."
        );
        console2.log("topLevelProtectionMinHealthFactor");
        console2.logUint(lasna.topLevelMinHealthFactor);
        console2.log("topLevelProtectionRescueAmount");
        console2.logUint(lasna.topLevelRescueAmount);
        console2.log("topLevelProtectionCooldownBlocks");
        console2.logUint(lasna.topLevelCooldownBlocks);
        console2.log("topLevelProtectionAvailableReserve");
        console2.logUint(lasna.topLevelAvailableReserve);
        console2.log("topLevelProtectionCommittedReserve");
        console2.logUint(lasna.topLevelCommittedReserve);
        console2.log("topLevelProtectionLastRescueBlock");
        console2.logUint(lasna.topLevelLastRescueBlock);
        console2.log("topLevelProtectionActive");
        console2.log(lasna.topLevelActive);

        console2.log("--- Expected Rescue Decision ---");
        console2.log("decision");
        console2.logUint(decision);
        console2.log("decisionLabel");
        console2.log(_decisionLabel(decision));
        console2.log("repayAmount");
        console2.logUint(repayAmount);
        console2.log("reserveAfter");
        console2.logUint(reserveAfter);
        console2.log("committedAfter");
        console2.logUint(committedAfter);
    }

    function _loadSepoliaSnapshot(
        bytes32 positionId,
        address owner,
        uint256 sepoliaFork
    ) private returns (SepoliaSnapshot memory snapshot) {
        vm.selectFork(sepoliaFork);

        BackstopVault reserveVault = BackstopVault(payable(vm.envAddress("BACKSTOP_VAULT")));
        AaveV3BackstopAdapter adapter = AaveV3BackstopAdapter(
            payable(vm.envAddress("BACKSTOP_LENDING_ADAPTER"))
        );

        snapshot.blockNumber = block.number;
        snapshot = _loadVaultConfig(snapshot, reserveVault, positionId);
        snapshot = _loadAdapterState(snapshot, adapter, positionId);
        snapshot = _loadSepoliaBalances(snapshot, reserveVault, owner);
    }

    function _loadLasnaSnapshot(
        bytes32 positionId,
        address owner,
        uint256 lasnaFork
    ) private returns (LasnaSnapshot memory snapshot) {
        vm.selectFork(lasnaFork);

        address backstopAddress = vm.envAddress("BACKSTOP_REACTIVE_CONTRACT");
        address monitorAddress = _envOrAddress("BACKSTOP_MONITOR_REACTIVE_CONTRACT", address(0));
        BackstopReactiveContract reactiveContract = BackstopReactiveContract(payable(backstopAddress));
        IPayable systemContract = IPayable(payable(_envOrAddress("SYSTEM_CONTRACT_ADDR", DEFAULT_SYSTEM_CONTRACT)));

        snapshot.blockNumber = block.number;
        snapshot.callbackGasLimit = reactiveContract.callbackGasLimit();
        snapshot.reserveVault = reactiveContract.reserveVault();
        snapshot.lendingAdapter = reactiveContract.lendingAdapter();
        snapshot.rescueExecutor = reactiveContract.rescueExecutor();
        snapshot.backstopBalance = backstopAddress.balance;
        snapshot.backstopDebt = _safeDebt(systemContract, backstopAddress);
        snapshot = _loadTopLevelProtection(snapshot, reactiveContract, positionId);
        snapshot = _loadMonitorState(snapshot, systemContract, monitorAddress, owner);
    }

    function _loadPositionOwner() private view returns (address owner) {
        try vm.envAddress("BACKSTOP_POSITION_OWNER") returns (address configuredOwner) {
            return configuredOwner;
        } catch {
            uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
            return vm.addr(sepoliaPk);
        }
    }

    function _loadVaultConfig(
        SepoliaSnapshot memory snapshot,
        BackstopVault reserveVault,
        bytes32 positionId
    ) private view returns (SepoliaSnapshot memory) {
        (
            snapshot.vaultOwner,
            snapshot.vaultAvailableReserve,
            snapshot.vaultCommittedReserve,
            snapshot.vaultMinHealthFactor,
            snapshot.vaultRescueAmount,
            snapshot.vaultCooldownBlocks,
            snapshot.vaultActive
        ) = reserveVault.positions(positionId);

        return snapshot;
    }

    function _loadAdapterState(
        SepoliaSnapshot memory snapshot,
        AaveV3BackstopAdapter adapter,
        bytes32 positionId
    ) private view returns (SepoliaSnapshot memory) {
        (
            snapshot.trackedUser,
            snapshot.debtAsset,
            snapshot.variableDebtToken,
            snapshot.adapterActive
        ) = adapter.getPosition(positionId);

        if (snapshot.adapterActive) {
            IAaveV3Pool pool = adapter.pool();
            (, , , , , snapshot.healthFactor) = pool.getUserAccountData(snapshot.trackedUser);
            snapshot.debtOutstanding = IERC20Like(snapshot.variableDebtToken).balanceOf(snapshot.trackedUser);
        }

        return snapshot;
    }

    function _loadSepoliaBalances(
        SepoliaSnapshot memory snapshot,
        BackstopVault reserveVault,
        address owner
    ) private view returns (SepoliaSnapshot memory) {
        IERC20AllowanceLike usdc = IERC20AllowanceLike(
            _envOrAddress("BACKSTOP_AAVE_USDC", DEFAULT_AAVE_SEPOLIA_USDC)
        );

        snapshot.executorLiquidity = AaveV3BackstopExecutorLike(
            payable(vm.envAddress("BACKSTOP_EXECUTOR"))
        ).availableLiquidity();
        snapshot.ownerUsdcBalance = usdc.balanceOf(owner);
        snapshot.ownerVaultAllowance = usdc.allowance(owner, address(reserveVault));

        return snapshot;
    }

    function _loadTopLevelProtection(
        LasnaSnapshot memory snapshot,
        BackstopReactiveContract reactiveContract,
        bytes32 positionId
    ) private view returns (LasnaSnapshot memory) {
        (
            snapshot.topLevelMinHealthFactor,
            snapshot.topLevelRescueAmount,
            snapshot.topLevelCooldownBlocks,
            snapshot.topLevelAvailableReserve,
            snapshot.topLevelCommittedReserve,
            snapshot.topLevelLastRescueBlock,
            snapshot.topLevelActive
        ) = reactiveContract.protections(positionId);

        return snapshot;
    }

    function _loadMonitorState(
        LasnaSnapshot memory snapshot,
        IPayable systemContract,
        address monitorAddress,
        address owner
    ) private view returns (LasnaSnapshot memory) {
        if (monitorAddress == address(0)) {
            return snapshot;
        }

        snapshot.watchedAccount = AavePositionMonitorReactiveContract(
            payable(monitorAddress)
        ).watchedAccounts(owner);
        snapshot.monitorBalance = monitorAddress.balance;
        snapshot.monitorDebt = _safeDebt(systemContract, monitorAddress);

        return snapshot;
    }

    function _safeDebt(IPayable systemContract, address target) private view returns (uint256 debtAmount) {
        try systemContract.debt(target) returns (uint256 value) {
            return value;
        } catch {
            return 0;
        }
    }

    function _decisionLabel(uint8 decision) private pure returns (string memory) {
        if (decision == REASON_INACTIVE) {
            return "inactive";
        }
        if (decision == REASON_HEALTHY) {
            return "healthy";
        }
        if (decision == REASON_RESERVE_TOO_LOW) {
            return "reserve_too_low";
        }
        if (decision == REASON_COOLDOWN_ACTIVE) {
            return "cooldown_active";
        }
        if (decision == REASON_ZERO_REPAY) {
            return "zero_repay";
        }
        if (decision == REASON_TRIGGER_READY) {
            return "trigger_ready";
        }
        return "unknown";
    }

    function _previewExpectedRescue(
        uint256 minHealthFactor,
        uint256 rescueAmount,
        uint256 cooldownBlocks,
        uint256 availableReserve,
        uint256 committedReserve,
        uint256 lastRescueBlock,
        bool active,
        uint256 healthFactor,
        uint256 debtOutstanding,
        uint256 blockNumber
    )
        private
        pure
        returns (uint8 decision, uint256 repayAmount, uint256 reserveAfter, uint256 committedAfter)
    {
        if (!active) {
            return (REASON_INACTIVE, 0, availableReserve, committedReserve);
        }

        if (healthFactor > minHealthFactor) {
            return (REASON_HEALTHY, 0, availableReserve, committedReserve);
        }

        if (availableReserve == 0 || availableReserve < rescueAmount) {
            return (REASON_RESERVE_TOO_LOW, 0, availableReserve, committedReserve);
        }

        if (
            cooldownBlocks > 0 &&
            lastRescueBlock > 0 &&
            blockNumber < lastRescueBlock + cooldownBlocks
        ) {
            return (REASON_COOLDOWN_ACTIVE, 0, availableReserve, committedReserve);
        }

        repayAmount = rescueAmount;
        if (repayAmount > debtOutstanding) {
            repayAmount = debtOutstanding;
        }

        if (repayAmount == 0) {
            return (REASON_ZERO_REPAY, 0, availableReserve, committedReserve);
        }

        return (
            REASON_TRIGGER_READY,
            repayAmount,
            availableReserve - repayAmount,
            committedReserve + repayAmount
        );
    }
}

interface AaveV3BackstopExecutorLike {
    function availableLiquidity() external view returns (uint256);
}

interface IERC20AllowanceLike is IERC20Like {
    function allowance(address owner, address spender) external view returns (uint256);
}
