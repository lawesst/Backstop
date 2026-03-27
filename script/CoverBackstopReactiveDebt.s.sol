// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

interface IDebtCover {
    function coverDebt() external;
}

contract CoverBackstopReactiveDebt is Script {
    function run() external {
        uint256 reactivePk = vm.envUint("REACTIVE_PRIVATE_KEY");
        address backstop = vm.envAddress("BACKSTOP_REACTIVE_CONTRACT");

        vm.startBroadcast(reactivePk);
        IDebtCover(backstop).coverDebt();

        try vm.envAddress("BACKSTOP_MONITOR_REACTIVE_CONTRACT") returns (address monitor) {
            if (monitor != address(0)) {
                IDebtCover(monitor).coverDebt();
            }
        } catch {
            // Optional monitor deployment.
        }
        vm.stopBroadcast();

        console2.log("Covered configured Lasna Backstop debt");
    }
}
