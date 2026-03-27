// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/backstop/AaveV3BackstopAdapter.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract SyncBackstopAavePosition is BackstopScriptBase {
    function run() external {
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address owner = _positionOwner(sepoliaPk);
        bytes32 positionId = _positionId(owner);

        AaveV3BackstopAdapter adapter = AaveV3BackstopAdapter(
            payable(vm.envAddress("BACKSTOP_LENDING_ADAPTER"))
        );

        vm.startBroadcast(sepoliaPk);
        adapter.syncPosition(positionId);
        vm.stopBroadcast();

        console2.log("Synced Backstop Aave position");
        console2.logBytes32(positionId);
        console2.log("owner");
        console2.logAddress(owner);
    }
}
