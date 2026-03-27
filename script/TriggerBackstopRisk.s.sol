// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/backstop/BackstopLendingAdapter.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract TriggerBackstopRisk is BackstopScriptBase {
    function run() external {
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address deployer = vm.addr(sepoliaPk);

        BackstopLendingAdapter lendingAdapter = BackstopLendingAdapter(
            vm.envAddress("BACKSTOP_LENDING_ADAPTER")
        );

        uint256 riskCollateralValue = _envOrUint(
            "BACKSTOP_RISK_COLLATERAL_VALUE",
            DEFAULT_RISK_COLLATERAL_VALUE
        );

        bytes32 positionId = _positionId(deployer);

        vm.startBroadcast(sepoliaPk);
        lendingAdapter.updateCollateralValue(positionId, riskCollateralValue);
        vm.stopBroadcast();

        console2.log("Triggered Backstop risk event for position");
        console2.logBytes32(positionId);
    }
}
