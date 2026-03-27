# Backstop Technical Overview

Backstop is a Reactive-native liquidation protection system.

This implementation demonstrates a full rescue loop:

- a user configures protection in a reserve-side vault
- a lending position emits a degraded risk signal
- a Reactive Smart Contract evaluates policy in ReactVM
- reserve and rescue callbacks are posted automatically
- reserve is committed
- debt is repaid on the lending side

The core point is architectural: Backstop uses Reactive Network to react to third-party protocol events and trigger deterministic follow-up execution without an off-chain keeper.

## Contract Set

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

## Rescue Flow

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

## Mocked Scope

- The lending market is simplified to focus on reactive control flow.
- Rescue liquidity on the debt chain is pre-funded in the executor.
- Reserve capital on the reserve chain is committed, not bridged.

This is intentional. It isolates the event-driven control plane from bridge, routing, and pooled-liquidity concerns.

## Local Verification

Run the test suite:

```bash
forge test
```

The current tests cover:

- static Reactive subscriptions are registered
- rescue fires when health factor falls below threshold
- rescue is skipped if reserve is insufficient
- preview logic reports cooldown correctly
- the Aave adapter exposes live health-factor and debt reads

## Live Aave Proof

The repo includes a live Aave V3 Sepolia integration path:

- [AaveV3BackstopAdapter.sol](./AaveV3BackstopAdapter.sol)
- [AaveV3BackstopExecutor.sol](./AaveV3BackstopExecutor.sol)
- [AavePositionMonitorReactiveContract.sol](./AavePositionMonitorReactiveContract.sol)
- [DeployBackstopAaveSepolia.s.sol](../../script/DeployBackstopAaveSepolia.s.sol)
- [DeployBackstopAaveLasna.s.sol](../../script/DeployBackstopAaveLasna.s.sol)
- [SetupBackstopAaveSepolia.s.sol](../../script/SetupBackstopAaveSepolia.s.sol)
- [SyncBackstopAavePosition.s.sol](../../script/SyncBackstopAavePosition.s.sol)

Successful clean-stack proof on March 27, 2026:

- `syncPosition(...)`: `0x5ddf2ecf3ec382e42cccdae2879d231f550ffaf83629813bf7614455f9cc6ece`
- `ReserveCommitted` callback: `0xbdb2de69ed59aae282eec72f3390c5380330864b3c8a12a4001097cfcc232d7c`
- `RescueExecuted` callback: `0x1859c3b12093a21db8dbb351bc36f45070a281c029335996bf5e5efec3ab4242`

Clean-stack end state:

- vault `availableReserve = 0`
- vault `committedReserve = 50,000,000`
- executor liquidity `= 0`
- borrower variable debt reduced by about `25,000,000`

Implementation notes from the live path:

- raw Lasna deployment works reliably when constructor simulation is bypassed
- Aave `Borrow` monitoring must handle both `topic_2` and `topic_3`
- callback ordering matters on Sepolia
- Lasna system debt must be covered before repeated rescue cycles

The full deployment log and proof history are in [TESTNET.md](./TESTNET.md).

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

## Runbooks

- primary testnet runbook: [TESTNET.md](./TESTNET.md)
- Sepolia + Lasna deploy scripts live under `script/`
- useful inspection helpers:
  - [InspectBackstopAaveState.s.sol](../../script/InspectBackstopAaveState.s.sol)
  - [CoverBackstopReactiveDebt.s.sol](../../script/CoverBackstopReactiveDebt.s.sol)
