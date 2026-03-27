// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "../src/backstop/AaveV3BackstopAdapter.sol";
import "../src/backstop/AaveV3BackstopExecutor.sol";
import "../src/backstop/AaveV3Interfaces.sol";
import "../src/backstop/BackstopVault.sol";
import "../src/backstop/IERC20Like.sol";
import "./backstop/BackstopScriptBase.s.sol";

contract SetupBackstopAaveSepolia is BackstopScriptBase {
    uint256 internal constant VARIABLE_RATE_MODE = 2;

    struct Config {
        uint256 sepoliaPk;
        address owner;
        address callbackProxy;
        address faucet;
        address debtAsset;
        address debtToken;
        address collateralAsset;
        address pool;
        uint256 minHealthFactor;
        uint256 rescueAmount;
        uint256 reserveAmount;
        uint256 cooldownBlocks;
        uint256 callbackFunding;
        uint256 wethSupplyAmount;
        uint256 initialBorrowAmount;
    }

    function run() external {
        Config memory config = _loadConfig();
        bytes32 positionId = _positionId(config.owner);

        BackstopVault vault = BackstopVault(payable(vm.envAddress("BACKSTOP_VAULT")));
        AaveV3BackstopAdapter adapter = AaveV3BackstopAdapter(payable(vm.envAddress("BACKSTOP_LENDING_ADAPTER")));
        AaveV3BackstopExecutor executor = AaveV3BackstopExecutor(payable(vm.envAddress("BACKSTOP_EXECUTOR")));

        vm.startBroadcast(config.sepoliaPk);

        IAaveFaucet(config.faucet).mint(config.collateralAsset, config.owner, config.wethSupplyAmount);
        IAaveFaucet(config.faucet).mint(
            config.debtAsset,
            config.owner,
            config.reserveAmount + config.rescueAmount
        );

        IERC20Like(config.collateralAsset).approve(config.pool, config.wethSupplyAmount);
        IAaveV3Pool(config.pool).supply(config.collateralAsset, config.wethSupplyAmount, config.owner, 0);

        IAaveV3Pool(config.pool).borrow(
            config.debtAsset,
            config.initialBorrowAmount,
            VARIABLE_RATE_MODE,
            0,
            config.owner
        );

        vault.configureProtection(
            positionId,
            config.minHealthFactor,
            config.rescueAmount,
            config.cooldownBlocks
        );

        IERC20Like(config.debtAsset).approve(address(vault), config.reserveAmount);
        vault.depositReserve(positionId, config.reserveAmount);

        adapter.configurePosition(positionId, config.owner, config.debtAsset, config.debtToken);

        IERC20Like(config.debtAsset).approve(address(executor), config.rescueAmount);
        executor.fundLiquidity(config.rescueAmount);

        IDepositTo(config.callbackProxy).depositTo{value: config.callbackFunding}(address(vault));
        IDepositTo(config.callbackProxy).depositTo{value: config.callbackFunding}(address(adapter));
        IDepositTo(config.callbackProxy).depositTo{value: config.callbackFunding}(address(executor));

        vm.stopBroadcast();

        console2.log("Backstop Aave Sepolia setup complete");
        console2.log("positionId");
        console2.logBytes32(positionId);
        console2.log("owner");
        console2.logAddress(config.owner);
    }

    function _loadConfig() private view returns (Config memory config) {
        config.sepoliaPk = vm.envUint("SEPOLIA_PRIVATE_KEY");
        config.owner = _positionOwner(config.sepoliaPk);
        config.callbackProxy = _envOrAddress("SEPOLIA_CALLBACK_PROXY", DEFAULT_SEPOLIA_CALLBACK_PROXY);
        config.faucet = _envOrAddress("AAVE_SEPOLIA_FAUCET", DEFAULT_AAVE_SEPOLIA_FAUCET);
        config.debtAsset = _envOrAddress("AAVE_SEPOLIA_USDC", DEFAULT_AAVE_SEPOLIA_USDC);
        config.debtToken = _envOrAddress(
            "AAVE_SEPOLIA_USDC_V_TOKEN",
            DEFAULT_AAVE_SEPOLIA_USDC_V_TOKEN
        );
        config.collateralAsset = _envOrAddress("AAVE_SEPOLIA_WETH", DEFAULT_AAVE_SEPOLIA_WETH);
        config.pool = _envOrAddress("AAVE_SEPOLIA_POOL", DEFAULT_AAVE_SEPOLIA_POOL);
        config.minHealthFactor = _envOrUint("BACKSTOP_MIN_HEALTH_FACTOR", DEFAULT_MIN_HEALTH_FACTOR);
        config.rescueAmount = _envOrUint("BACKSTOP_RESCUE_AMOUNT", DEFAULT_RESCUE_AMOUNT);
        config.reserveAmount = _envOrUint("BACKSTOP_RESERVE_AMOUNT", DEFAULT_RESERVE_AMOUNT);
        config.cooldownBlocks = _envOrUint("BACKSTOP_COOLDOWN_BLOCKS", DEFAULT_COOLDOWN_BLOCKS);
        config.callbackFunding = _envOrUint(
            "BACKSTOP_CALLBACK_NATIVE_FUNDING",
            DEFAULT_CALLBACK_NATIVE_FUNDING
        );
        config.wethSupplyAmount = _envOrUint(
            "BACKSTOP_AAVE_WETH_SUPPLY",
            DEFAULT_AAVE_WETH_SUPPLY
        );
        config.initialBorrowAmount = _envOrUint(
            "BACKSTOP_AAVE_INITIAL_BORROW_AMOUNT",
            DEFAULT_AAVE_INITIAL_BORROW_AMOUNT
        );
    }
}
