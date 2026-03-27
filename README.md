# Backstop

Backstop is a Reactive Network project for autonomous cross-chain liquidation protection.

It watches a borrower's risk on Sepolia, mirrors protection state inside ReactVM, and posts callback transactions that commit reserve capital and execute rescue actions when a position falls below policy thresholds.

## What This Repository Includes

- Solidity contracts for reserve management, risk adapters, rescue execution, and Reactive contracts
- A mock lending path for local testing
- A live Aave V3 Sepolia integration path
- Sepolia and Reactive Lasna deployment scripts
- Broadcast artifacts and testnet proof transactions
- A lightweight demo dashboard for live walkthroughs

## Architecture

- `BackstopVault`
  - Stores protection settings and reserve balances
  - Accepts Reactive callbacks to commit reserves

- `BackstopReactiveContract`
  - Subscribes to reserve and risk events
  - Mirrors protection state inside ReactVM
  - Emits reserve and rescue callbacks when a position breaches policy

- `AaveV3BackstopAdapter`
  - Reads live Aave user account data on Sepolia
  - Emits normalized `HealthFactorUpdated` events for Backstop

- `AaveV3BackstopExecutor`
  - Receives Sepolia callbacks
  - Repays live Aave debt with prefunded liquidity

- `AavePositionMonitorReactiveContract`
  - Watches raw Aave Pool activity
  - Requests Sepolia adapter syncs when tracked accounts change

## Repository Layout

- `src/demos/backstop`
  - Backstop contracts and project-specific docs
- `script`
  - Sepolia and Lasna deploy/setup/run scripts
- `test`
  - Foundry coverage for Backstop core flows
- `broadcast`
  - Recorded script broadcasts for proof runs

## Quick Start

1. Install Foundry.

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Clone the repo and pull submodules.

```bash
git clone https://github.com/lawesst/backstop-reactive.git
cd backstop-reactive
git submodule update --init --recursive
```

3. Run the test suite.

```bash
forge test
```

## Demo UI

Run the local demo server:

```bash
node script/backstop/serve-backstop-ui.mjs
```

Then open `http://localhost:4173`.

## Testnet Workflow

The Sepolia and Reactive Lasna workflow, deployed addresses, transaction hashes, and live debugging notes are documented in:

- `src/demos/backstop/TESTNET.md`

The contract-level design and project-specific notes live in:

- `src/demos/backstop/README.md`

## Current Live Status

- The original Aave path proved live reserve callbacks on Sepolia and narrowed the rescue failure to executor callback gas budgeting.
- A fresh clean-stack deployment proved raw on-chain Lasna deployment works and uncovered an Aave borrow-topic bug in the monitor, which is now fixed in code and covered by tests.
- The remaining live issue is on the fresh Lasna Backstop side after Sepolia emits normalized `HealthFactorUpdated` events.

## Environment Files

- `.env.backstop.example`
  - Sample variables for Sepolia and Reactive Lasna runs
- `.env.backstop`
  - Local-only file and intentionally ignored by git
