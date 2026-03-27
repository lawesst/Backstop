# Backstop Testnet Runbook

This runbook wires Backstop into a real Sepolia + Reactive Lasna workflow.

Current recommended path:

- `Ethereum Sepolia` hosts:
  - reserve vault
  - lending adapter
  - mock lending market
  - rescue executor
- `Reactive Lasna` hosts:
  - Backstop reactive contract

This keeps the flow simple while still generating real:

- Sepolia deployment transactions
- Lasna deployment transactions
- Sepolia risk-trigger transaction
- Lasna reactive execution transaction
- Sepolia callback transactions

## Official network values used here

- `Ethereum Sepolia chain ID`: `11155111`
- `Reactive Lasna chain ID`: `5318007`
- `Sepolia callback proxy`: `0xc9f36411C9897e7F959D99ffca2a0Ba7ee0D7bDA`
- `Reactive system contract`: `0x0000000000000000000000000000000000fffFfF`

These values are taken from Reactive's official docs:

- [Origins & Destinations](https://dev.reactive.network/origins-and-destinations)
- [Reactive Mainnet / Lasna Testnet](https://dev.reactive.network/reactive-mainnet)
- [Economy](https://dev.reactive.network/economy)

## Prerequisites

You need:

- Sepolia ETH for Sepolia deployments
- lREACT on Reactive Lasna for the reactive contract
- one EOA for Sepolia
- one EOA for Lasna

The same private key may be used on both networks. If you do that, the scripts automatically use the Lasna deployer address as the authorized reactive sender for callback validation.

## 1. Configure environment

Copy `.env.backstop.example` and fill in the private keys:

```bash
cp .env.backstop.example .env.backstop
source .env.backstop
```

## 2. Deploy the Sepolia side

```bash
source .env.backstop
forge script script/DeployBackstopSepolia.s.sol:DeployBackstopSepolia \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast
```

Save the printed addresses back into `.env.backstop`:

- `BACKSTOP_VAULT`
- `BACKSTOP_LENDING_ADAPTER`
- `BACKSTOP_EXECUTOR`

## 3. Deploy the Reactive contract on Lasna

```bash
source .env.backstop
forge create --broadcast \
  --rpc-url "$REACTIVE_RPC" \
  --private-key "$REACTIVE_PRIVATE_KEY" \
  src/backstop/BackstopReactiveContract.sol:BackstopReactiveContract \
  --value 0.2ether \
  --constructor-args \
    $BACKSTOP_RESERVE_CHAIN_ID \
    $BACKSTOP_VAULT \
    $BACKSTOP_DEBT_CHAIN_ID \
    $BACKSTOP_LENDING_ADAPTER \
    $BACKSTOP_EXECUTOR \
    500000
```

After deployment:

- fund the reactive contract if needed
- open the contract in [Lasna Reactscan](https://lasna.reactscan.net/)
- verify that subscriptions are active

## 3b. Replay protection state if Sepolia was seeded first

The Sepolia deploy script emits `ProtectionConfigured` and `ReserveUpdated` before the Lasna
contract exists. If you deploy Lasna after running the Sepolia script, replay those events once so
the RSC mirrors the current reserve and threshold state.

Use the `positionId` printed by `DeployBackstopSepolia`:

```bash
source .env.backstop
forge script script/ReplayBackstopState.s.sol:ReplayBackstopState \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast
```

If your protected position owner is not the same address as `SEPOLIA_PRIVATE_KEY`, set
`BACKSTOP_POSITION_OWNER` in `.env.backstop` first.

The replay script intentionally does a zero-amount deposit. That re-emits `ReserveUpdated`
without changing balances.

## 4. Trigger the risk event on Sepolia

```bash
source .env.backstop
forge script script/TriggerBackstopRisk.s.sol:TriggerBackstopRisk \
  --rpc-url "$SEPOLIA_RPC" \
  --broadcast
```

This lowers the tracked collateral value and emits a `HealthFactorUpdated` event from the lending adapter.

## 5. Collect transaction hashes

Record the hashes for:

- Sepolia deploy transactions
- Lasna deploy transaction
- Sepolia risk-trigger transaction
- Lasna reactive transaction
- Sepolia callback transaction to `BackstopVault`
- Sepolia callback transaction to `BackstopExecutor`

Use:

- Sepolia explorer for origin and callback transactions
- [Lasna Reactscan](https://lasna.reactscan.net/) for the deployment transaction
- Lasna system-contract logs for the callback-posting transaction and the RVM transaction hash

## What success looks like

- the lending adapter emits the degraded health factor event
- the reactive contract reacts on Lasna
- two callbacks are generated
- reserve is committed in the vault
- executor repays part of the debt

## Current limitations of this testnet setup

- reserve capital is pre-funded on Sepolia instead of being bridged from another chain
- the lending protocol is mocked, while the adapter shape is real
- callback funding and reactive funding are pre-provisioned

This is enough to produce proof-of-concept transaction hashes and show that Reactive is the automation layer driving the rescue flow.

## Aave Sepolia integration attempt

The repo now contains a second, real-protocol path that uses:

- live Aave V3 Sepolia USDC debt
- live Aave collateral on Sepolia
- a Sepolia adapter that reads `getUserAccountData()`
- a Sepolia executor that calls Aave `repay(...)`
- a second Lasna reactive contract that watches Aave Pool account events

### Live Aave deployment set

Date:

- `March 27, 2026`

Sepolia contracts:

- `BackstopVault`: `0x82B78985fC07Bc9868bEd357A9dFF0B710212F6e`
- `AaveV3BackstopAdapter`: `0x6d165fAA504Fdc111a5dBA6651546FFDC87bB8AB`
- `AaveV3BackstopExecutor`: `0xc6f2e814f9845FD9404585049aF2147a35943cc6`

Lasna contracts:

- `BackstopReactiveContract`: `0x3C76B3404dd108173952Ff9dD8Bcb58c4ECe945e`
- `AavePositionMonitorReactiveContract`: `0x93D1ba29FaDC0bA6a8863A9B21C70d6D5Db006dd`

Core deployment transactions:

- `Sepolia BackstopVault`: `0xe5de92b0df8bcc3df1fb11d0dc720e580ff33d17d27afbf0c6c48af4803213c9`
- `Sepolia AaveV3BackstopAdapter`: `0xd009a1c1347ff5f7f662cd67f5b8f051b53fc32f6c40eda4dbee55e5ba72f0f6`
- `Sepolia AaveV3BackstopExecutor`: `0x8a2d3db2a777292e3782e6ee3efd0c56a92910a1168ae8ff23adc0f70fcd0609`
- `Lasna BackstopReactiveContract`: `0x40de2f67c4ee071a7573b8a5065235c23533237f89a648975893350e5d19e8a8`
- `Lasna AavePositionMonitorReactiveContract`: `0x719075507283d51cd88f98d28a0c7f268e50db8b04926a9a9629dd1af39e95f7`
- `Lasna watchAccount`: `0xbad9123d191f28262c8dd893c9d89c9997c6c4d779f29fad6d5ffd2010a4a71c`

Live Aave position transactions:

- `Sepolia setup borrow path`: `0xf19d9eeecd554f8c95fb95aa7d70876a0e757030e98d96913482fda7a3a41ede`
- `Sepolia risk borrow`: `0x4fd985858a73a550e91d4947e1d262046ef0d7c6e7383fee4e2b1af88a04237f`
- `Manual live adapter sync after threshold breach`: `0x7eff1998ab8d61a06de368888c4b7426df31e66f073e9ed1d1e59b5c6a8d3026`

Supporting retune transactions:

- `Mint LINK collateral`: `0xee0550487b659b55558583e0656b74d03813e8492ecdc910ad701c7ce175200f`
- `Supply LINK`: `0x765eed96c95eca95aca8d7b68ade8852727f8d34a8c3e55a0ddadf10bcdb2b40`
- `Disable AAVE as collateral`: `0xcf4a69d99f5e22bab0d7c6dc18ffbce51d257cfb8753e7fd0d14935297a0b08c`
- `Raise rescue amount to 100 USDC`: `0x59517354b0d5c3f42798314938a164b88e0ea604581c9c2e0176332ebcf007e1`
- `Top up reserve to 200 USDC`: `0xcd9a094bde10df4302f9c548279f667f1645df164cd85708c3dae5da60f3445e`
- `Top up executor to 100 USDC`: `0x7696d8659347f663716963f7304f91aa25b641587812e032d8809f754d6bd5ab`

### Current state

What is working:

- the real Aave V3 Sepolia borrower is live
- the adapter can read and emit the live Aave health factor
- the monitored position is below the Backstop threshold on Sepolia
- the Lasna contracts are deployed, funded, and subscribed

What is still blocked:

- the reserve callback now succeeds after replaying Aave vault state
- the executor callback is still failing on Sepolia for the Aave path
- the older Lasna Backstop contract currently carries unpaid system debt, which blocks the cleanest rerun on that stack

Observed Sepolia state after the latest live sync:

- `health factor`: about `1.125e18`
- `vault available reserve`: `100,000,000`
- `vault committed reserve`: `100,000,000`
- `executor liquidity`: `100,000,000`

Latest debugging proof set:

- `Replay Aave protection config`: `0x8a740c5345b149f64784186cad9ede3515d92220e830b11b7ff3e0f88f42cb82`
- `Replay Aave reserve update`: `0x5d86b3b239553650f5ac2287aa798c069c37a76e1d1934e711350b3477acf1ee`
- `Manual Aave syncPosition`: `0x3e13e37385fab8380e2cfeb5ca202c4fffdbfcbf70d74de3166fe3a313fd2303`
- `Latest syncPosition rerun`: `0xe3b0138ccdc860365c78e82e04c0818ff6ee24842d302aec7cb98464dff69176`
- `Reserve commit callback success`: `0x6126d5e66dc7f6ae6f085f6667b16c16dba6e48afdff046da27fe6c78521f033`
- `Executor callback failure`: `0xf30bb8470e36c45164221e2d407725f2fe1a588996b2424a70bc3caa005f6016`
- `Latest Sepolia replay protection`: `0x99ed3c184a4bda32ffbf90b9e5ea29d5d8ec56863ca809778a61dd0c91b6208f`
- `Latest Sepolia replay reserve`: `0x91b93813d9e5358818aaefde6c7b33e59b0fa5b59556b2edc0d56e1b4ba3a5bb`
- `Sepolia -> Lasna faucet request for deployer`: `0xe9bab491204cb746568422adf4526f6af6d3becfa54089d645c84702b972447e`

Callback-failure diagnosis:

- the Sepolia callback proxy emitted `CallbackFailure(address,bytes)` for the Aave executor
- the failed payload targets `executeRescue(address,bytes32,uint256)` with the correct RVM sender and `positionId`
- simulating the exact executor call from the callback proxy succeeds
- gas simulation shows the call reverts below roughly `300k`
- the current Aave Lasna deployment used a `500k` callback gas limit, which appears too tight once callback-proxy overhead is included
- querying `protections(positionId)` on the top-level Lasna Backstop contract is not a valid mirror-health check because ReactVM state is separate from top-level Reactive contract storage
- the right live inspection targets are Sepolia callback transactions, Lasna contract balance/debt, and Reactscan RVM traces
- the older Aave Backstop contract currently shows about `0.02 REACT` balance and about `0.0044185 REACT` unpaid debt
- the latest rerun emitted a fresh `HealthFactorUpdated` event on Sepolia, but the vault and executor balances stayed unchanged afterward, so the current blocker is between event emission and callback posting on Lasna

Recommended next live attempt:

- use `CoverBackstopReactiveDebt.s.sol` after the Lasna deployer receives enough REACT to clear outstanding debt
- redeploy the Aave Backstop reactive contract with `BACKSTOP_AAVE_CALLBACK_GAS_LIMIT=1000000`
- replay the Aave vault state
- use `SyncBackstopAavePosition.s.sol` to emit a fresh `HealthFactorUpdated`

Useful live-debug commands:

```bash
forge script script/InspectBackstopAaveState.s.sol:InspectBackstopAaveState
forge script script/CoverBackstopReactiveDebt.s.sol:CoverBackstopReactiveDebt \
  --rpc-url "$REACTIVE_RPC" \
  --broadcast
```

This means the live Aave integration is now narrowed to a concrete runtime constraint, not an unknown architecture issue.

### Fresh clean-stack diagnostic run

Fresh deployer:

- `Sepolia + Lasna EOA`: `0x4b3f725984D30eA7E8a4092a4Bf684B97B99370C`

Fresh Sepolia contracts:

- `BackstopVault`: `0xA33Df4fE1bee85588A94b4EFCa72B8cE6808Aeda`
- `AaveV3BackstopAdapter`: `0x3cc147B897B4e57b201e71A75E403B52a7dA04b0`
- `AaveV3BackstopExecutor`: `0xaAb5Bc6118d40af31de383C0d271194614af9476`

Fresh Lasna contracts:

- `BackstopReactiveContract` raw deploy: `0xdAD1a325CaC52Ecb4C347e6525970736c362B3Dd`
- `AavePositionMonitorReactiveContract` raw deploy: `0x3B2C40D3F2c1310FEB1888361a341f46dB8A9033`
- `Patched AavePositionMonitorReactiveContract` raw deploy: `0x21188518aCCc09D2E0B281eA99f6538597e80CDE`

Fresh proof transactions:

- `Sepolia fund fresh EOA`: `0xe3525e75a0e6d8bed48044b14fb81e2b81e0a79056c58514b0c78b4537ca6e8c`
- `Lasna fund fresh EOA`: `0x091fe897ff00671680030089e1bab93d2e94af7dba0bbe1c2a360430fc0163f4`
- `Sepolia -> Lasna faucet request`: `0x3736a9379826298faf197ef50196d26d7222c55e35f07083ce7f055d399b7bce`
- `Fresh Sepolia BackstopVault`: `0x67864d0f9bd7181905b93225af36efa549d9ffd98a76e356309a37dec4f84c24`
- `Fresh Sepolia AaveV3BackstopAdapter`: `0x6ff2f912a2ecb76af1a1fc42ec1020332e8cff322cab15d8d20f059fc1c03af2`
- `Fresh Sepolia AaveV3BackstopExecutor`: `0xe362115550eee2c99ae4e7fc191c74060c08d4197ce754234e3f6119c3971ddc`
- `Fresh Lasna BackstopReactiveContract`: `0xd7384d1223a0269f60df3dab74ef683104d329af7950e01bc3c3e65fb702758c`
- `Fresh Lasna Aave monitor`: `0x6f0b674cb8c04dd8caead1f097b5066f295e65ef31d8dce319db17f53aa74b53`
- `Fresh Lasna watchAccount`: `0x7da365623fe18292b3a6f725ca7662ecf7441e3f97463999d8a0f48211a67ed1`
- `Fresh Sepolia risk borrow (1000 USDC)`: `0x45ace380120a6a8faef35283f4cce722d664a12875edadf69eb0c68e050ecad3`
- `Patched Lasna Aave monitor`: `0x3acdfc0842abd62279bb63d8872ac9e1278467181416477a56933dd317b1d915`
- `Patched Lasna watchAccount`: `0x2cf6411857dc6cf18c85f4fed75293278678650d057aab8e0da9035e20dd5fa3`
- `Tiny Sepolia borrow after patched watch`: `0x2a60bddfbeab59fbf8c377cd693bf7399fc19280f19763b6ef262049b834e33f`
- `Manual Sepolia syncPosition`: `0x772d67e0c5a66073fc9471ee84a567eb5a6f9c9fd3a0b2bbd7508a7468657a60`

Fresh findings:

- Foundry's local constructor execution falsely reverts on `service.subscribe(...)` for fresh Lasna deploys, but the raw on-chain `CREATE` path succeeds.
- The Aave Sepolia `Borrow(address,address,address,uint256,uint8,uint256,uint16)` log that matters for user tracking exposes the borrower in `topic_2`; the original monitor only subscribed to `topic_3`.
- The patched monitor is now covered by tests, but the fresh live stack still needs one more Lasna-side fix: after `syncPosition(...)` emits `HealthFactorUpdated` on Sepolia, the fresh Backstop RSC still does not post Sepolia callback transactions.

## Latest public proof run

Date:

- `March 27, 2026`

Deployer wallet:

- `0x5508532b027D57b020e6C0BeDB1fE19a6d6C555c`

Sepolia contracts:

- `MockUSDC`: `0x74d1e4919dfdbfd7494b0040f09f91286a9d1109`
- `MockLendingMarket`: `0xd880304d41ab741a23f1760259cb751828869da1`
- `BackstopLendingAdapter`: `0xb5c1CD1d7a0b6539645eeddc83e5e9AeB37Fe929`
- `BackstopVault`: `0xfa83C25d5185849Eb2AD372B1448CB641702b483`
- `BackstopExecutor`: `0x05774D9DED46085383b82fA850423e02a79983b2`

Lasna contract:

- `BackstopReactiveContract`: `0x7ce18b45986E9b69A12bF021b6D14f873e7BA5dA`

Deployment transactions:

- `Sepolia MockUSDC`: `0x8c4ef6e8bfc3c26fd95b9f0bac10ff5e50ee5c9d076d79b07be24ab76bb2272b`
- `Sepolia MockLendingMarket`: `0xcf3f996cc4aa01b6e7c94fc2e9b0c12a28d30cdc72ca91abf39f6d2de0388d63`
- `Sepolia BackstopLendingAdapter`: `0x1b3ef77cd77c2433178beb578255aaf40e2e2a0f0044aa2cac53ef8eb6bd4611`
- `Sepolia BackstopExecutor`: `0x7fde942126c98b7ce09f45183f2500d1d231558f39fa536b744017d0d6736a4b`
- `Sepolia BackstopVault`: `0xd559462061d9e92dde6b7e0e3b570ae58cc5dde5b4bcf93b1bf6e3b8e543879d`
- `Lasna BackstopReactiveContract`: `0x94e8e66ec5657a92586e5da4b7cde18b9c5cdce53736c751e87b02b345b97582`

State sync and trigger transactions:

- `Replay protection config`: `0xbb19cc80ef3d9b9f165ebf9719e05abdf2130c93ac541c830fabf459573c20b8`
- `Replay reserve update`: `0x66ef7e30b3228201970ab79fade5bc8c08513783b46ffabff3fa29bcddf22fb2`
- `Risk trigger on Sepolia`: `0x7efd7f51d81496e6d390c86d6258a690a43de79ae3c29706b6094f171d070335`

Reactive execution proof:

- `Lasna callback-posting tx`: `0xcc25ef4e1ba3f05c2b2660ef29101e3cfc9eaa3ffbe70af49580166bf1a32721`
- `RVM tx hash from CallbackPosted logs`: `0xf9d286a77d46a41c6d01b7575675774d2a57858e22707c9d39af93feaa9e66b3`

Sepolia callback transactions:

- `Reserve commit callback`: `0xcef7d02e63be0dbebe9b647376be7503e4af1f17b95f5907806d916d91000f76`
- `Debt rescue callback`: `0xdd62f5aebf9c8c29189440cbd5dd975dd5cd1b329f4217ea607af92700a8114d`

Observed end state after rescue:

- Risk event lowered the position health factor from `0.9e18` to below the `1.15e18` threshold.
- Backstop committed `25,000,000` reserve units and executed a `25,000,000` debt repayment.
- The lending market ended at `75,000,000` debt outstanding with health factor `1.2e18`.
- The reserve vault ended with `25,000,000` available and `25,000,000` committed reserve.
