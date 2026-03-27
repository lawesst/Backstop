// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/demos/backstop/BackstopExecutor.sol";
import "../src/demos/backstop/BackstopLendingAdapter.sol";
import "../src/demos/backstop/BackstopVault.sol";
import "../src/demos/backstop/IERC20Like.sol";
import "../src/demos/backstop/MockLendingMarket.sol";
import "../src/demos/backstop/MockUSDC.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract DeployBackstopSepolia is BackstopScriptBase {
    struct SepoliaConfig {
        uint256 sepoliaPk;
        address deployer;
        address callbackProxy;
        uint256 minHealthFactor;
        uint256 rescueAmount;
        uint256 reserveAmount;
        uint256 cooldownBlocks;
        uint256 callbackFunding;
        uint256 collateralValue;
        uint256 debtOutstanding;
    }

    struct Deployment {
        MockUSDC asset;
        MockLendingMarket lendingMarket;
        BackstopLendingAdapter lendingAdapter;
        BackstopExecutor executor;
        BackstopVault vault;
    }

    function run() external {
        SepoliaConfig memory config = _loadConfig();
        bytes32 positionId = _positionId(config.deployer);

        vm.startBroadcast(config.sepoliaPk);
        Deployment memory deployment = _deploy(config);
        _seedDemoState(config, deployment, positionId);
        vm.stopBroadcast();

        console2.log("Backstop Sepolia deployment complete");
        console2.log("positionId");
        console2.logBytes32(positionId);
        _logDeployment("asset", address(deployment.asset));
        _logDeployment("vault", address(deployment.vault));
        _logDeployment("lendingMarket", address(deployment.lendingMarket));
        _logDeployment("lendingAdapter", address(deployment.lendingAdapter));
        _logDeployment("executor", address(deployment.executor));
        console2.log("reactiveRvmId");
        console2.logAddress(vm.addr(_envOrUint("REACTIVE_PRIVATE_KEY", config.sepoliaPk)));
    }

    function _loadConfig() private view returns (SepoliaConfig memory config) {
        config.sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");

        config.deployer = vm.addr(config.sepoliaPk);
        config.callbackProxy = _envOrAddress(
            "SEPOLIA_CALLBACK_PROXY",
            DEFAULT_SEPOLIA_CALLBACK_PROXY
        );
        config.minHealthFactor = _envOrUint("BACKSTOP_MIN_HEALTH_FACTOR", DEFAULT_MIN_HEALTH_FACTOR);
        config.rescueAmount = _envOrUint("BACKSTOP_RESCUE_AMOUNT", DEFAULT_RESCUE_AMOUNT);
        config.reserveAmount = _envOrUint("BACKSTOP_RESERVE_AMOUNT", DEFAULT_RESERVE_AMOUNT);
        config.cooldownBlocks = _envOrUint("BACKSTOP_COOLDOWN_BLOCKS", DEFAULT_COOLDOWN_BLOCKS);
        config.callbackFunding = _envOrUint(
            "BACKSTOP_CALLBACK_NATIVE_FUNDING",
            DEFAULT_CALLBACK_NATIVE_FUNDING
        );
        config.collateralValue = _envOrUint(
            "BACKSTOP_COLLATERAL_VALUE",
            DEFAULT_COLLATERAL_VALUE
        );
        config.debtOutstanding = _envOrUint(
            "BACKSTOP_DEBT_OUTSTANDING",
            DEFAULT_DEBT_OUTSTANDING
        );
    }

    function _deploy(SepoliaConfig memory config) private returns (Deployment memory deployment) {
        deployment.asset = new MockUSDC();
        deployment.lendingMarket = new MockLendingMarket(deployment.asset);
        deployment.lendingAdapter = new BackstopLendingAdapter(deployment.lendingMarket);
        deployment.executor = new BackstopExecutor(
            deployment.asset,
            deployment.lendingMarket,
            deployment.lendingAdapter,
            config.callbackProxy
        );
        deployment.vault = new BackstopVault(
            IERC20Like(address(deployment.asset)),
            config.callbackProxy
        );

        deployment.lendingMarket.setRescueExecutor(address(deployment.executor));
    }

    function _seedDemoState(
        SepoliaConfig memory config,
        Deployment memory deployment,
        bytes32 positionId
    ) private {
        deployment.asset.mint(
            config.deployer,
            config.reserveAmount + config.rescueAmount + config.rescueAmount
        );
        deployment.asset.approve(address(deployment.vault), config.reserveAmount);
        deployment.asset.approve(address(deployment.executor), config.rescueAmount);

        deployment.vault.configureProtection(
            positionId,
            config.minHealthFactor,
            config.rescueAmount,
            config.cooldownBlocks
        );
        deployment.vault.depositReserve(positionId, config.reserveAmount);
        deployment.executor.fundLiquidity(config.rescueAmount);
        deployment.lendingAdapter.openPosition(
            positionId,
            config.collateralValue,
            config.debtOutstanding
        );

        IDepositTo(config.callbackProxy).depositTo{value: config.callbackFunding}(address(deployment.vault));
        IDepositTo(config.callbackProxy).depositTo{value: config.callbackFunding}(address(deployment.executor));
    }
}
