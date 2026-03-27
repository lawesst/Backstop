// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/demos/backstop/AaveV3Interfaces.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract TriggerBackstopAaveRisk is BackstopScriptBase {
    uint256 internal constant VARIABLE_RATE_MODE = 2;

    function run() external {
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        address owner = _positionOwner(sepoliaPk);

        address debtAsset = _envOrAddress("AAVE_SEPOLIA_USDC", DEFAULT_AAVE_SEPOLIA_USDC);
        address pool = _envOrAddress("AAVE_SEPOLIA_POOL", DEFAULT_AAVE_SEPOLIA_POOL);
        uint256 borrowAmount = _envOrUint(
            "BACKSTOP_AAVE_RISK_BORROW_AMOUNT",
            DEFAULT_AAVE_RISK_BORROW_AMOUNT
        );

        vm.startBroadcast(sepoliaPk);
        IAaveV3Pool(pool).borrow(debtAsset, borrowAmount, VARIABLE_RATE_MODE, 0, owner);
        vm.stopBroadcast();

        console2.log("Triggered Backstop Aave risk borrow");
        console2.logAddress(owner);
        console2.log("borrowAmount");
        console2.logUint(borrowAmount);
    }
}
