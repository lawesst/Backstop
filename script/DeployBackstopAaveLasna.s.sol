// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/demos/backstop/AavePositionMonitorReactiveContract.sol";
import "../src/demos/backstop/BackstopReactiveContract.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract DeployBackstopAaveLasna is BackstopScriptBase {
    function run() external {
        uint256 reactivePk = vm.envUint("REACTIVE_PRIVATE_KEY");
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");

        address reserveVault = vm.envAddress("BACKSTOP_VAULT");
        address lendingAdapter = vm.envAddress("BACKSTOP_LENDING_ADAPTER");
        address rescueExecutor = vm.envAddress("BACKSTOP_EXECUTOR");
        address lendingPool = _envOrAddress("AAVE_SEPOLIA_POOL", DEFAULT_AAVE_SEPOLIA_POOL);

        uint256 reserveChainId = _envOrUint("BACKSTOP_RESERVE_CHAIN_ID", SEPOLIA_CHAIN_ID);
        uint256 debtChainId = _envOrUint("BACKSTOP_DEBT_CHAIN_ID", SEPOLIA_CHAIN_ID);
        uint64 backstopCallbackGasLimit = uint64(
            _envOrUint("BACKSTOP_AAVE_CALLBACK_GAS_LIMIT", DEFAULT_AAVE_CALLBACK_GAS_LIMIT)
        );
        uint64 monitorCallbackGasLimit = uint64(
            _envOrUint(
                "BACKSTOP_AAVE_MONITOR_CALLBACK_GAS_LIMIT",
                DEFAULT_CALLBACK_GAS_LIMIT
            )
        );
        uint256 reactiveFunding = _envOrUint("BACKSTOP_REACTIVE_FUNDING", DEFAULT_REACTIVE_FUNDING);
        uint256 monitorFunding = _envOrUint(
            "BACKSTOP_MONITOR_REACTIVE_FUNDING",
            DEFAULT_REACTIVE_FUNDING
        );

        address watchedAccount = _positionOwner(sepoliaPk);

        vm.startBroadcast(reactivePk);

        BackstopReactiveContract backstop = new BackstopReactiveContract{value: reactiveFunding}(
            reserveChainId,
            reserveVault,
            debtChainId,
            lendingAdapter,
            rescueExecutor,
            backstopCallbackGasLimit
        );

        AavePositionMonitorReactiveContract monitor = new AavePositionMonitorReactiveContract{value: monitorFunding}(
            debtChainId,
            lendingPool,
            lendingAdapter,
            monitorCallbackGasLimit
        );

        monitor.watchAccount(watchedAccount);

        vm.stopBroadcast();

        console2.log("Backstop Aave Lasna deployment complete");
        _logDeployment("backstopReactiveContract", address(backstop));
        _logDeployment("aaveMonitorReactiveContract", address(monitor));
        console2.log("backstopCallbackGasLimit");
        console2.logUint(backstopCallbackGasLimit);
        console2.log("monitorCallbackGasLimit");
        console2.logUint(monitorCallbackGasLimit);
        console2.log("watchedAccount");
        console2.logAddress(watchedAccount);
    }
}
