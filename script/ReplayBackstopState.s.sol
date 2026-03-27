// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/backstop/BackstopVault.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract ReplayBackstopState is BackstopScriptBase {
    function run() external {
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address owner = _envOrAddress("BACKSTOP_POSITION_OWNER", vm.addr(sepoliaPk));
        bytes32 positionId = _positionId(owner);

        BackstopVault vault = BackstopVault(payable(vm.envAddress("BACKSTOP_VAULT")));

        uint256 minHealthFactor = _envOrUint(
            "BACKSTOP_MIN_HEALTH_FACTOR",
            DEFAULT_MIN_HEALTH_FACTOR
        );
        uint256 rescueAmount = _envOrUint("BACKSTOP_RESCUE_AMOUNT", DEFAULT_RESCUE_AMOUNT);
        uint256 cooldownBlocks = _envOrUint(
            "BACKSTOP_COOLDOWN_BLOCKS",
            DEFAULT_COOLDOWN_BLOCKS
        );

        vm.startBroadcast(sepoliaPk);
        vault.configureProtection(positionId, minHealthFactor, rescueAmount, cooldownBlocks);
        vault.depositReserve(positionId, 0);
        vm.stopBroadcast();

        console2.log("Replayed Backstop protection state for position");
        console2.logBytes32(positionId);
        console2.log("owner");
        console2.logAddress(owner);
    }
}
