// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/demos/backstop/AaveV3BackstopAdapter.sol";
import "../src/demos/backstop/AaveV3BackstopExecutor.sol";
import "../src/demos/backstop/AaveV3Interfaces.sol";
import "../src/demos/backstop/BackstopVault.sol";
import "../src/demos/backstop/IERC20Like.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract DeployBackstopAaveSepolia is BackstopScriptBase {
    function run() external {
        uint256 sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");

        address callbackProxy = _envOrAddress(
            "SEPOLIA_CALLBACK_PROXY",
            DEFAULT_SEPOLIA_CALLBACK_PROXY
        );
        address debtAsset = _envOrAddress("AAVE_SEPOLIA_USDC", DEFAULT_AAVE_SEPOLIA_USDC);
        address pool = _envOrAddress("AAVE_SEPOLIA_POOL", DEFAULT_AAVE_SEPOLIA_POOL);

        vm.startBroadcast(sepoliaPk);

        BackstopVault vault = new BackstopVault(
            IERC20Like(debtAsset),
            callbackProxy
        );

        AaveV3BackstopAdapter adapter = new AaveV3BackstopAdapter(
            IAaveV3Pool(pool),
            callbackProxy
        );

        AaveV3BackstopExecutor executor = new AaveV3BackstopExecutor(
            IERC20Like(debtAsset),
            IAaveV3Pool(pool),
            adapter,
            callbackProxy
        );

        vm.stopBroadcast();

        console2.log("Backstop Aave Sepolia deployment complete");
        _logDeployment("vault", address(vault));
        _logDeployment("adapter", address(adapter));
        _logDeployment("executor", address(executor));
    }
}
