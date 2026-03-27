// SPDX-License-Identifier: MIT

pragma solidity >=0.8.20;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

interface IDepositTo {
    function depositTo(address target) external payable;
}

abstract contract BackstopScriptBase is Script {
    address internal constant DEFAULT_SYSTEM_CONTRACT =
        0x0000000000000000000000000000000000fffFfF;

    address internal constant DEFAULT_SEPOLIA_CALLBACK_PROXY =
        0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA;

    address internal constant DEFAULT_AAVE_SEPOLIA_POOL =
        0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;

    address internal constant DEFAULT_AAVE_SEPOLIA_FAUCET =
        0xC959483DBa39aa9E78757139af0e9a2EDEb3f42D;

    address internal constant DEFAULT_AAVE_SEPOLIA_USDC =
        0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

    address internal constant DEFAULT_AAVE_SEPOLIA_USDC_V_TOKEN =
        0x36B5dE936eF1710E1d22EabE5231b28581a92ECc;

    address internal constant DEFAULT_AAVE_SEPOLIA_WETH =
        0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c;

    uint256 internal constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 internal constant LASNA_CHAIN_ID = 5318007;

    uint256 internal constant DEFAULT_MIN_HEALTH_FACTOR = 1.15e18;
    uint256 internal constant DEFAULT_RESCUE_AMOUNT = 25_000_000;
    uint256 internal constant DEFAULT_RESERVE_AMOUNT = 50_000_000;
    uint256 internal constant DEFAULT_COLLATERAL_VALUE = 150_000_000;
    uint256 internal constant DEFAULT_DEBT_OUTSTANDING = 100_000_000;
    uint256 internal constant DEFAULT_RISK_COLLATERAL_VALUE = 90_000_000;
    uint256 internal constant DEFAULT_COOLDOWN_BLOCKS = 25;
    uint256 internal constant DEFAULT_CALLBACK_NATIVE_FUNDING = 0.002 ether;
    uint256 internal constant DEFAULT_REACTIVE_FUNDING = 1 ether;
    uint64 internal constant DEFAULT_CALLBACK_GAS_LIMIT = 500_000;
    uint64 internal constant DEFAULT_AAVE_CALLBACK_GAS_LIMIT = 1_000_000;
    uint256 internal constant DEFAULT_AAVE_WETH_SUPPLY = 1 ether;
    uint256 internal constant DEFAULT_AAVE_INITIAL_BORROW_AMOUNT = 1_000e6;
    uint256 internal constant DEFAULT_AAVE_RISK_BORROW_AMOUNT = 500e6;

    function _envOrAddress(string memory name, address defaultValue) internal view returns (address) {
        try vm.envAddress(name) returns (address value) {
            return value;
        } catch {
            return defaultValue;
        }
    }

    function _envOrUint(string memory name, uint256 defaultValue) internal view returns (uint256) {
        try vm.envUint(name) returns (uint256 value) {
            return value;
        } catch {
            return defaultValue;
        }
    }

    function _positionId(address owner) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("backstop-demo", owner));
    }

    function _positionOwner(uint256 sepoliaPk) internal view returns (address) {
        try vm.envAddress("BACKSTOP_POSITION_OWNER") returns (address owner) {
            return owner;
        } catch {
            return vm.addr(sepoliaPk);
        }
    }

    function _logDeployment(string memory label, address value) internal pure {
        console2.log(label);
        console2.logAddress(value);
    }
}
