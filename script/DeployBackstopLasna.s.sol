// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/demos/backstop/BackstopReactiveContract.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract DeployBackstopLasna is BackstopScriptBase {
    function run() external {
        uint256 reactivePk = vm.envUint("REACTIVE_PRIVATE_KEY");

        address reserveVault = vm.envAddress("BACKSTOP_VAULT");
        address lendingAdapter = vm.envAddress("BACKSTOP_LENDING_ADAPTER");
        address rescueExecutor = vm.envAddress("BACKSTOP_EXECUTOR");

        uint256 reserveChainId = _envOrUint("BACKSTOP_RESERVE_CHAIN_ID", SEPOLIA_CHAIN_ID);
        uint256 debtChainId = _envOrUint("BACKSTOP_DEBT_CHAIN_ID", SEPOLIA_CHAIN_ID);
        uint64 callbackGasLimit = uint64(
            _envOrUint("BACKSTOP_CALLBACK_GAS_LIMIT", DEFAULT_CALLBACK_GAS_LIMIT)
        );
        uint256 reactiveFunding = _envOrUint("BACKSTOP_REACTIVE_FUNDING", DEFAULT_REACTIVE_FUNDING);

        vm.startBroadcast(reactivePk);

        BackstopReactiveContract reactiveContract = new BackstopReactiveContract{value: reactiveFunding}(
            reserveChainId,
            reserveVault,
            debtChainId,
            lendingAdapter,
            rescueExecutor,
            callbackGasLimit
        );

        vm.stopBroadcast();

        console2.log("Backstop Lasna deployment complete");
        _logDeployment("reactiveContract", address(reactiveContract));
    }
}
