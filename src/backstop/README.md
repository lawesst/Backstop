# Backstop

Backstop is a liquidation protection system built for Reactive Network.

This implementation demonstrates the core rescue flow:

- a user configures liquidation protection on a reserve chain
- a lending position becomes risky on a debt chain
- a Reactive Smart Contract detects the risk event
- the Reactive Smart Contract emits cross-chain callbacks
- reserve is committed on the reserve chain
- rescue liquidity repays debt on the debt chain

## Why This Matters

Traditional smart contracts cannot wake up when a third-party lending position degrades and then coordinate responses across multiple chains on their own.

Backstop uses Reactive's core primitive:

- subscribe to on-chain events
- process them in ReactVM
- trigger callback execution automatically

The important thing this project proves is not a production bridge. It proves the event-driven control plane that makes autonomous cross-chain liquidation defense possible.

## Contracts

### Reserve side

- `BackstopVault.sol`
  - stores per-position protection settings
  - holds reserve capital
  - emits reserve and policy events
  - accepts Reactive callbacks to commit remote reserve

### Debt side

- `BackstopLendingAdapter.sol`
  - emits normalized risk events for Reactive to subscribe to
  - gives the project a more realistic integration boundary than reading demo-market events directly

- `AaveV3BackstopAdapter.sol`
  - reads live Aave V3 account health data on Sepolia
  - emits the same normalized `HealthFactorUpdated` event shape as the mock adapter
  - keeps the reactive rescue contract protocol-agnostic

- `MockLendingMarket.sol`
  - models a borrow position with collateral value and debt
  - accepts rescue repayment from an executor

- `BackstopExecutor.sol`
  - receives Reactive callbacks on the debt chain
  - uses pre-funded rescue liquidity to repay the lending position
  - asks the adapter to re-emit the updated health factor after rescue

- `AaveV3BackstopExecutor.sol`
  - repays live Aave V3 variable debt with prefunded USDC liquidity
  - re-syncs the live Aave position through the adapter after repayment

### Reactive side

- `BackstopReactiveContract.sol`
  - subscribes to reserve-side events and adapter-side risk events
  - mirrors protection state inside ReactVM
  - decides when a rescue should happen
  - emits callbacks to both chains when thresholds are breached

- `AavePositionMonitorReactiveContract.sol`
  - subscribes to live Aave Pool account-changing events
  - emits a callback to the Sepolia adapter so it can refresh `getUserAccountData()`
  - is the event-driven bridge between raw Aave logs and Backstop's normalized rescue path

### Test helpers

- `MockUSDC.sol`
- `MockSubscriptionService.sol`

## Flow

1. A user configures protection for `positionId` in `BackstopVault`.
2. The user deposits reserve capital into the vault.
3. The Reactive contract mirrors:
   - protection thresholds
   - rescue amount
   - available reserve
   - inside ReactVM rather than the top-level Lasna contract storage
4. A lending position on the debt chain emits a degraded `HealthFactorUpdated` event.
5. The Reactive contract checks:
   - protection is active
   - health factor is below threshold
   - enough reserve is available
   - cooldown is satisfied
6. If valid, the Reactive contract emits two callbacks:
   - `commitReserve(...)` on the reserve chain
   - `executeRescue(...)` on the debt chain
7. The reserve side marks funds as committed and the debt side repays part of the loan.

## What Is Mocked In This Version

- The lending market is simplified to focus on reactive control flow.
- Rescue liquidity on the debt chain is pre-funded in the executor.
- Reserve capital on the reserve chain is committed, not bridged.

This is intentional for scope control. It isolates the Reactive logic that makes autonomous liquidation defense possible.

## Local Verification

Run the test suite:

```bash
forge test
```

The current tests prove:

- static Reactive subscriptions are registered
- rescue fires when health factor falls below threshold
- rescue is skipped if reserve is insufficient
- preview logic reports cooldown correctly
- the Aave adapter exposes live health-factor and debt reads

## Next Steps

- use `ReplayBackstopState.s.sol` to remove manual state re-sync after Lasna deployment
- finish the last mile of the Aave Sepolia reactive callback path
- use the included testnet deploy scripts for Sepolia + Reactive Lasna
- integrate a bridge or settlement adapter for reserve-backed replenishment
- add a minimal web UI for position registration and rescue history

## Testnet Wiring

The repo now includes a Sepolia + Reactive Lasna deployment path:

- [TESTNET.md](./TESTNET.md)
- [DeployBackstopSepolia.s.sol](../../script/DeployBackstopSepolia.s.sol)
- [DeployBackstopLasna.s.sol](../../script/DeployBackstopLasna.s.sol)
- [ReplayBackstopState.s.sol](../../script/ReplayBackstopState.s.sol)
- [TriggerBackstopRisk.s.sol](../../script/TriggerBackstopRisk.s.sol)

The latest live proof run and explorer links are recorded in
[TESTNET.md](./TESTNET.md).

## Aave Sepolia Path

The repo now also includes a live Aave V3 Sepolia integration path:

- [AaveV3BackstopAdapter.sol](./AaveV3BackstopAdapter.sol)
- [AaveV3BackstopExecutor.sol](./AaveV3BackstopExecutor.sol)
- [AavePositionMonitorReactiveContract.sol](./AavePositionMonitorReactiveContract.sol)
- [DeployBackstopAaveSepolia.s.sol](../../script/DeployBackstopAaveSepolia.s.sol)
- [DeployBackstopAaveLasna.s.sol](../../script/DeployBackstopAaveLasna.s.sol)
- [SetupBackstopAaveSepolia.s.sol](../../script/SetupBackstopAaveSepolia.s.sol)
- [TriggerBackstopAaveRisk.s.sol](../../script/TriggerBackstopAaveRisk.s.sol)
- [SyncBackstopAavePosition.s.sol](../../script/SyncBackstopAavePosition.s.sol)

Current status:

- live Sepolia contracts are deployed and funded
- a real Aave V3 Sepolia borrower is live and tracked by the adapter
- the position has been driven below the Backstop threshold on Sepolia
- the reserve callback leg is now confirmed live on Sepolia
- a second clean-stack deployment now exists under a fresh Sepolia + Lasna EOA
- the remaining blockers are:
- the executor callback gas budget on the original Aave rescue leg
- a fresh Lasna-side ingestion/runtime issue after the adapter emits `HealthFactorUpdated`

Latest diagnosis:

- reading `protections(positionId)` on the top-level Lasna contract is a false diagnostic because ReactVM state is separate from the top-level Reactive contract state
- the right live signals are Sepolia callback transactions, Lasna balance/debt, and RVM execution traces
- replaying the Aave vault state and forcing a fresh `syncPosition(...)` produced a live `ReserveCommitted` callback on Sepolia
- the paired executor callback was dispatched by the Sepolia callback proxy but failed with `CallbackFailure(address,bytes)`
- simulating `executeRescue(...)` against the live executor succeeds once the gas cap reaches about `300k`
- the current Aave Lasna deploy used a `500k` callback gas budget, which appears too tight once proxy overhead is included
- a fresh `syncPosition(...)` rerun on March 27, 2026 emitted `HealthFactorUpdated` on Sepolia again, but the reserve and executor balances remained unchanged afterward
- a clean Lasna deploy under a fresh EOA succeeds on-chain when sent as a raw `CREATE`; Foundry's local constructor execution falsely reverts on `service.subscribe(...)`
- Aave Sepolia `Borrow` events surface the tracked user in `topic_2`, so the monitor now subscribes to both `topic_2` and `topic_3`
- after a manual Sepolia `syncPosition(...)` on the fresh stack, the adapter emits `HealthFactorUpdated` but the fresh Backstop RSC still does not post Sepolia reserve/executor callbacks

That means the protocol integration work is real and reusable, and the next live attempt is straightforward:

- redeploy the Aave Backstop reactive contract with a higher callback gas limit
- use the patched monitor on the next clean deployment
- continue debugging the fresh Lasna Backstop ingestion/runtime path after normalized adapter events
- keep Lasna Backstop debt covered before replaying or rerunning the live rescue path

Useful debugging scripts:

- [InspectBackstopAaveState.s.sol](../../script/InspectBackstopAaveState.s.sol)
- [CoverBackstopReactiveDebt.s.sol](../../script/CoverBackstopReactiveDebt.s.sol)

## Demo Dashboard

There is now a buildless Backstop UI for demos and grant reviews:

- [index.html](./ui/index.html)
- [app.js](./ui/app.js)
- [styles.css](./ui/styles.css)
- [serve-backstop-ui.mjs](../../script/backstop/serve-backstop-ui.mjs)

Run it from the repo root:

```bash
node script/backstop/serve-backstop-ui.mjs
```

Then open `http://localhost:4173`.

The dashboard:

- reads live Sepolia and Lasna state through a local RPC proxy
- shows the live Aave proof transaction set
- focuses on the current Sepolia + Lasna deployment rather than the earlier mock demo
- supports the minimum useful Sepolia actions for a live rerun:
  - replay protection
  - replay reserve
  - sync position
