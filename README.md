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

- `src/backstop`
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

The current UI is intentionally minimal and pointed at the live Aave Sepolia plus Lasna stack. It shows proof links, live health and reserve state, Lasna contract debt, and the replay or sync actions used during debugging.

## Testnet Workflow

The Sepolia and Reactive Lasna workflow, deployed addresses, transaction hashes, and live debugging notes are documented in:

- `src/backstop/TESTNET.md`

The contract-level design and project-specific notes live in:

- `src/backstop/README.md`

## Current Live Status

- A fresh clean-stack deployment on March 27, 2026 completed a full live Aave V3 Sepolia rescue.
- The successful clean-stack proof path is:
  - sync trigger: `0x5ddf2ecf3ec382e42cccdae2879d231f550ffaf83629813bf7614455f9cc6ece`
  - reserve commit callback: `0xbdb2de69ed59aae282eec72f3390c5380330864b3c8a12a4001097cfcc232d7c`
  - rescue execution callback: `0x1859c3b12093a21db8dbb351bc36f45070a281c029335996bf5e5efec3ab4242`
- The clean-stack run also proved:
  - raw on-chain Lasna `CREATE` works when Foundry constructor simulation falsely reverts on `service.subscribe(...)`
  - the Aave monitor must subscribe to both `Borrow` `topic_2` and `topic_3`
  - the Reactive contract must keep its Lasna system debt covered before subsequent rescue cycles
- The older Aave stack remains useful as a debugging trail for callback gas and debt-management issues, but the project now has a real end-to-end Sepolia proof set.
- The repo now includes targeted debugging helpers:
  - `script/InspectBackstopAaveState.s.sol`
  - `script/CoverBackstopReactiveDebt.s.sol`

## Environment Files

- `.env.backstop.example`
  - Sample variables for Sepolia and Reactive Lasna runs
- `.env.backstop`
  - Local-only file and intentionally ignored by git
