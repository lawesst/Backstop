import * as ethers from "https://esm.sh/ethers@6.13.5";

const config = {
  proofStartBlock: 10531690,
  networks: {
    sepolia: {
      name: "Ethereum Sepolia",
      chainId: 11155111,
      rpc: `${window.location.origin}/rpc/sepolia`,
      explorerTx: "https://sepolia.etherscan.io/tx/",
      explorerAddress: "https://sepolia.etherscan.io/address/",
    },
    lasna: {
      name: "Reactive Lasna",
      chainId: 5318007,
      rpc: `${window.location.origin}/rpc/lasna`,
      explorerTx: "https://lasna.reactscan.net/tx/",
      explorerAddress: "https://lasna.reactscan.net/address/",
    },
  },
  demoOwner: "0x5508532b027D57b020e6C0BeDB1fE19a6d6C555c",
  contracts: {
    token: "0x74d1e4919dfdbfd7494b0040f09f91286a9d1109",
    lendingMarket: "0xd880304d41ab741a23f1760259cb751828869da1",
    lendingAdapter: "0xb5c1CD1d7a0b6539645eeddc83e5e9AeB37Fe929",
    vault: "0xfa83C25d5185849Eb2AD372B1448CB641702b483",
    executor: "0x05774D9DED46085383b82fA850423e02a79983b2",
    reactive: "0x7ce18b45986E9b69A12bF021b6D14f873e7BA5dA",
  },
  proofLinks: [
    {
      label: "Risk Trigger",
      url: "https://sepolia.etherscan.io/tx/0x7efd7f51d81496e6d390c86d6258a690a43de79ae3c29706b6094f171d070335",
      hash: "0x7efd7f51d81496e6d390c86d6258a690a43de79ae3c29706b6094f171d070335",
    },
    {
      label: "Reactive Deploy",
      url: "https://lasna.reactscan.net/tx/0x94e8e66ec5657a92586e5da4b7cde18b9c5cdce53736c751e87b02b345b97582",
      hash: "0x94e8e66ec5657a92586e5da4b7cde18b9c5cdce53736c751e87b02b345b97582",
    },
    {
      label: "Callback Posting",
      url: "https://lasna.reactscan.net/tx/0xcc25ef4e1ba3f05c2b2660ef29101e3cfc9eaa3ffbe70af49580166bf1a32721",
      hash: "0xcc25ef4e1ba3f05c2b2660ef29101e3cfc9eaa3ffbe70af49580166bf1a32721",
    },
    {
      label: "RVM Execution",
      url: "https://lasna.reactscan.net/address/0x7ce18b45986E9b69A12bF021b6D14f873e7BA5dA/2890421",
      hash: "0xf9d286a77d46a41c6d01b7575675774d2a57858e22707c9d39af93feaa9e66b3",
    },
    {
      label: "Reserve Commit Callback",
      url: "https://sepolia.etherscan.io/tx/0xcef7d02e63be0dbebe9b647376be7503e4af1f17b95f5907806d916d91000f76",
      hash: "0xcef7d02e63be0dbebe9b647376be7503e4af1f17b95f5907806d916d91000f76",
    },
    {
      label: "Rescue Execution Callback",
      url: "https://sepolia.etherscan.io/tx/0xdd62f5aebf9c8c29189440cbd5dd975dd5cd1b329f4217ea607af92700a8114d",
      hash: "0xdd62f5aebf9c8c29189440cbd5dd975dd5cd1b329f4217ea607af92700a8114d",
    },
  ],
};

const vaultAbi = [
  "function positions(bytes32) view returns (address owner, uint256 availableReserve, uint256 committedReserve, uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks, bool active)",
  "function configureProtection(bytes32 positionId, uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks)",
  "function depositReserve(bytes32 positionId, uint256 amount)",
  "event ReserveCommitted(bytes32 indexed positionId, uint256 amount, address indexed reactiveSender)",
];

const tokenAbi = [
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const lendingMarketAbi = [
  "function positions(bytes32) view returns (address owner, uint256 collateralValue, uint256 debtOutstanding)",
  "function healthFactor(bytes32) view returns (uint256)",
  "event RescueApplied(bytes32 indexed positionId, uint256 repayAmount, uint256 newDebtOutstanding, uint256 newHealthFactor, address indexed executor)",
];

const lendingAdapterAbi = [
  "function openPosition(bytes32 positionId, uint256 collateralValue, uint256 debtOutstanding)",
  "function updateCollateralValue(bytes32 positionId, uint256 collateralValue)",
];

const executorAbi = [
  "function fundLiquidity(uint256 amount)",
  "function availableLiquidity() view returns (uint256)",
  "event RescueExecuted(bytes32 indexed positionId, uint256 amount, address indexed reactiveSender)",
];

const reactiveAbi = [
  "function protections(bytes32) view returns (uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks, uint256 availableReserve, uint256 committedReserve, uint256 lastRescueBlock, bool active)",
];

const state = {
  sepoliaProvider: new ethers.JsonRpcProvider(
    config.networks.sepolia.rpc,
    config.networks.sepolia.chainId
  ),
  lasnaProvider: new ethers.JsonRpcProvider(
    config.networks.lasna.rpc,
    config.networks.lasna.chainId
  ),
  browserProvider: null,
  signer: null,
  walletAddress: null,
};

const ui = {
  walletAddress: byId("walletAddress"),
  trackedOwnerBadge: byId("trackedOwnerBadge"),
  healthBadge: byId("healthBadge"),
  lastRefresh: byId("lastRefresh"),
  ownerInput: byId("ownerAddressInput"),
  ownerHint: byId("ownerHint"),
  positionId: byId("positionIdValue"),
  reactiveContractLink: byId("reactiveContractLink"),
  contractSummary: byId("contractSummary"),
  metricHealthFactor: byId("metricHealthFactor"),
  metricMinHealthFactor: byId("metricMinHealthFactor"),
  metricDebtOutstanding: byId("metricDebtOutstanding"),
  metricCollateralValue: byId("metricCollateralValue"),
  metricReserveAvailable: byId("metricReserveAvailable"),
  metricReserveCommitted: byId("metricReserveCommitted"),
  metricReactiveReserve: byId("metricReactiveReserve"),
  metricExecutorLiquidity: byId("metricExecutorLiquidity"),
  metricOwnerBalance: byId("metricOwnerBalance"),
  metricVaultAllowance: byId("metricVaultAllowance"),
  metricCooldown: byId("metricCooldown"),
  metricProtectionActive: byId("metricProtectionActive"),
  proofLinks: byId("proofLinks"),
  activityFeed: byId("activityFeed"),
  actionFeed: byId("actionFeed"),
  connectWallet: byId("connectWallet"),
  switchSepolia: byId("switchSepolia"),
  refreshState: byId("refreshState"),
  useConnectedWallet: byId("useConnectedWallet"),
  mintAmountInput: byId("mintAmountInput"),
  executorFundingInput: byId("executorFundingInput"),
  openCollateralInput: byId("openCollateralInput"),
  openDebtInput: byId("openDebtInput"),
  minHealthFactorInput: byId("minHealthFactorInput"),
  rescueAmountInput: byId("rescueAmountInput"),
  cooldownBlocksInput: byId("cooldownBlocksInput"),
  reserveDepositInput: byId("reserveDepositInput"),
  riskCollateralInput: byId("riskCollateralInput"),
  mintDemoFunds: byId("mintDemoFunds"),
  fundExecutor: byId("fundExecutor"),
  openPosition: byId("openPosition"),
  configureProtection: byId("configureProtection"),
  approveVault: byId("approveVault"),
  depositReserve: byId("depositReserve"),
  replayState: byId("replayState"),
  triggerRisk: byId("triggerRisk"),
};

const sepoliaContracts = {
  token: new ethers.Contract(config.contracts.token, tokenAbi, state.sepoliaProvider),
  vault: new ethers.Contract(config.contracts.vault, vaultAbi, state.sepoliaProvider),
  lendingMarket: new ethers.Contract(
    config.contracts.lendingMarket,
    lendingMarketAbi,
    state.sepoliaProvider
  ),
  lendingAdapter: new ethers.Contract(
    config.contracts.lendingAdapter,
    lendingAdapterAbi,
    state.sepoliaProvider
  ),
  executor: new ethers.Contract(config.contracts.executor, executorAbi, state.sepoliaProvider),
};

const reactiveContract = new ethers.Contract(
  config.contracts.reactive,
  reactiveAbi,
  state.lasnaProvider
);

ui.ownerInput.value = config.demoOwner;
ui.reactiveContractLink.href = `${config.networks.lasna.explorerAddress}${config.contracts.reactive}`;
ui.contractSummary.textContent = [
  shortAddress(config.contracts.vault),
  shortAddress(config.contracts.lendingAdapter),
  shortAddress(config.contracts.lendingMarket),
  shortAddress(config.contracts.executor),
].join("  ");

renderProofLinks();
bindEvents();
loadState().catch((error) => {
  pushFeed(
    ui.actionFeed,
    "Read Failure",
    friendlyError(error),
    "danger"
  );
});

function bindEvents() {
  ui.ownerInput.addEventListener("change", () => loadState());
  ui.refreshState.addEventListener("click", () => loadState());
  ui.connectWallet.addEventListener("click", connectWallet);
  ui.switchSepolia.addEventListener("click", switchToSepolia);
  ui.useConnectedWallet.addEventListener("click", () => {
    if (!state.walletAddress) return;
    ui.ownerInput.value = state.walletAddress;
    loadState();
  });

  ui.mintDemoFunds.addEventListener("click", () =>
    runSepoliaAction("Mint Demo Funds", async (contracts, signerAddress) => {
      const amount = parseToken(ui.mintAmountInput.value);
      const tx = await contracts.token.mint(signerAddress, amount);
      return { tx };
    })
  );

  ui.fundExecutor.addEventListener("click", () =>
    runSepoliaAction("Fund Executor", async (contracts) => {
      const amount = parseToken(ui.executorFundingInput.value);
      const approveTx = await contracts.token.approve(config.contracts.executor, amount);
      await approveTx.wait();
      pushActionUpdate(
        "Approve Executor",
        `Approved ${formatToken(amount)} mUSDC for executor funding.`,
        txAnchor(approveTx.hash, config.networks.sepolia)
      );

      const fundTx = await contracts.executor.fundLiquidity(amount);
      return { tx: fundTx };
    })
  );

  ui.openPosition.addEventListener("click", () =>
    runSepoliaAction("Open Demo Position", async (contracts) => {
      const positionId = currentPositionId();
      const collateralValue = parseToken(ui.openCollateralInput.value);
      const debtOutstanding = parseToken(ui.openDebtInput.value);
      const tx = await contracts.lendingAdapter.openPosition(
        positionId,
        collateralValue,
        debtOutstanding
      );
      return { tx };
    })
  );

  ui.configureProtection.addEventListener("click", () =>
    runSepoliaAction("Configure Protection", async (contracts) => {
      const tx = await contracts.vault.configureProtection(
        currentPositionId(),
        parseHealthFactor(ui.minHealthFactorInput.value),
        parseToken(ui.rescueAmountInput.value),
        BigInt(ui.cooldownBlocksInput.value || "0")
      );
      return { tx };
    })
  );

  ui.approveVault.addEventListener("click", () =>
    runSepoliaAction("Approve Vault", async (contracts) => {
      const tx = await contracts.token.approve(
        config.contracts.vault,
        parseToken(ui.reserveDepositInput.value)
      );
      return { tx };
    })
  );

  ui.depositReserve.addEventListener("click", () =>
    runSepoliaAction("Deposit Reserve", async (contracts) => {
      const tx = await contracts.vault.depositReserve(
        currentPositionId(),
        parseToken(ui.reserveDepositInput.value)
      );
      return { tx };
    })
  );

  ui.replayState.addEventListener("click", () =>
    runSepoliaAction("Replay State", async (contracts) => {
      const positionId = currentPositionId();
      const configureTx = await contracts.vault.configureProtection(
        positionId,
        parseHealthFactor(ui.minHealthFactorInput.value),
        parseToken(ui.rescueAmountInput.value),
        BigInt(ui.cooldownBlocksInput.value || "0")
      );
      await configureTx.wait();
      pushActionUpdate(
        "Replay Step 1",
        "Re-emitted ProtectionConfigured.",
        txAnchor(configureTx.hash, config.networks.sepolia)
      );

      const reserveTx = await contracts.vault.depositReserve(positionId, 0n);
      return { tx: reserveTx };
    })
  );

  ui.triggerRisk.addEventListener("click", () =>
    runSepoliaAction("Trigger Risk Event", async (contracts) => {
      const tx = await contracts.lendingAdapter.updateCollateralValue(
        currentPositionId(),
        parseToken(ui.riskCollateralInput.value)
      );
      return { tx };
    })
  );

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      state.walletAddress = accounts[0] ? ethers.getAddress(accounts[0]) : null;
      state.signer = null;
      updateWalletBadge();
      await loadState();
    });

    window.ethereum.on("chainChanged", async () => {
      state.signer = null;
      await connectWallet({ silent: true });
      await loadState();
    });
  }
}

async function connectWallet(options = {}) {
  if (!window.ethereum) {
    pushFeed(
      ui.actionFeed,
      "Wallet Missing",
      "Install a browser wallet with Sepolia support to use write actions.",
      "danger"
    );
    return;
  }

  state.browserProvider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await state.browserProvider.send(
    "eth_requestAccounts",
    options.silent ? [] : []
  );
  state.walletAddress = accounts[0] ? ethers.getAddress(accounts[0]) : null;
  state.signer = state.walletAddress ? await state.browserProvider.getSigner() : null;
  updateWalletBadge();
  await loadState();
}

async function switchToSepolia() {
  if (!window.ethereum) return;

  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
}

async function loadState() {
  const ownerAddress = normalizedOwner();
  const positionId = ownerAddress ? positionIdFor(ownerAddress) : null;

  ui.trackedOwnerBadge.textContent = ownerAddress ? shortAddress(ownerAddress) : "Invalid";
  ui.positionId.textContent = positionId ?? "Invalid owner";
  ui.ownerHint.textContent = ownerAddress
    ? "Backstop derives the demo position id from backstop-demo + owner."
    : "Enter a valid EVM address to inspect a Backstop position.";

  updateWalletBadge();

  if (!ownerAddress || !positionId) {
    setHealthBadge("Invalid Owner", "danger");
    return;
  }

  const [vaultPosition, marketPosition, healthFactor, ownerBalance, vaultAllowance, executorLiquidity, reactiveState] =
    await Promise.all([
      sepoliaContracts.vault.positions(positionId),
      sepoliaContracts.lendingMarket.positions(positionId),
      sepoliaContracts.lendingMarket.healthFactor(positionId),
      sepoliaContracts.token.balanceOf(ownerAddress),
      sepoliaContracts.token.allowance(ownerAddress, config.contracts.vault),
      sepoliaContracts.executor.availableLiquidity(),
      reactiveContract.protections(positionId),
    ]);

  const reserveAvailable = vaultPosition[1];
  const reserveCommitted = vaultPosition[2];
  const minHealthFactor = vaultPosition[3];
  const rescueAmount = vaultPosition[4];
  const cooldownBlocks = vaultPosition[5];
  const protectionActive = vaultPosition[6];

  const collateralValue = marketPosition[1];
  const debtOutstanding = marketPosition[2];

  ui.metricHealthFactor.textContent = formatHealth(healthFactor);
  ui.metricMinHealthFactor.textContent = formatHealth(minHealthFactor);
  ui.metricDebtOutstanding.textContent = `${formatToken(debtOutstanding)} mUSDC`;
  ui.metricCollateralValue.textContent = `${formatToken(collateralValue)} mUSDC`;
  ui.metricReserveAvailable.textContent = `${formatToken(reserveAvailable)} mUSDC`;
  ui.metricReserveCommitted.textContent = `${formatToken(reserveCommitted)} mUSDC`;
  ui.metricReactiveReserve.textContent = `${formatToken(reactiveState[3])} mUSDC`;
  ui.metricExecutorLiquidity.textContent = `${formatToken(executorLiquidity)} mUSDC`;
  ui.metricOwnerBalance.textContent = `${formatToken(ownerBalance)} mUSDC`;
  ui.metricVaultAllowance.textContent = `${formatToken(vaultAllowance)} mUSDC`;
  ui.metricCooldown.textContent = cooldownBlocks.toString();
  ui.metricProtectionActive.textContent = protectionActive ? "Yes" : "No";

  ui.minHealthFactorInput.value = trimNumber(formatHealthValue(minHealthFactor), 4);
  ui.rescueAmountInput.value = trimNumber(formatTokenValue(rescueAmount), 4);
  ui.cooldownBlocksInput.value = cooldownBlocks.toString();

  renderActivity(positionId);
  renderStatus({
    healthFactor,
    minHealthFactor,
    protectionActive,
    ownerAddress,
    debtOutstanding,
    reserveAvailable,
  });

  ui.lastRefresh.textContent = new Date().toLocaleTimeString();
}

function renderStatus({ healthFactor, minHealthFactor, protectionActive, ownerAddress, debtOutstanding, reserveAvailable }) {
  if (!protectionActive) {
    setHealthBadge("Inactive", "watch");
    return;
  }

  if (debtOutstanding === 0n) {
    setHealthBadge("Recovered", "safe");
    return;
  }

  if (healthFactor <= minHealthFactor) {
    setHealthBadge("At Risk", "danger");
    return;
  }

  const delta = healthFactor - minHealthFactor;
  if (delta <= ethers.parseUnits("0.1", 18) || reserveAvailable === 0n) {
    setHealthBadge("Watching", "watch");
    return;
  }

  if (state.walletAddress && ownerAddress === state.walletAddress) {
    setHealthBadge("Protected", "safe");
    return;
  }

  setHealthBadge("Healthy", "safe");
}

async function renderActivity(positionId) {
  try {
    const reserveLogs = await sepoliaContracts.vault.queryFilter(
      sepoliaContracts.vault.filters.ReserveCommitted(positionId),
      config.proofStartBlock
    );

    const rescueLogs = await sepoliaContracts.executor.queryFilter(
      sepoliaContracts.executor.filters.RescueExecuted(positionId),
      config.proofStartBlock
    );

    const marketLogs = await sepoliaContracts.lendingMarket.queryFilter(
      sepoliaContracts.lendingMarket.filters.RescueApplied(positionId),
      config.proofStartBlock
    );

    const entries = [];

    if (reserveLogs.length) {
      const log = reserveLogs.at(-1);
      entries.push({
        tone: "safe",
        title: "Reserve Committed",
        body: `${formatToken(log.args[1])} mUSDC committed by the vault callback.`,
        txHash: log.transactionHash,
      });
    }

    if (rescueLogs.length) {
      const log = rescueLogs.at(-1);
      entries.push({
        tone: "safe",
        title: "Rescue Executed",
        body: `${formatToken(log.args[1])} mUSDC repaid on the debt side.`,
        txHash: log.transactionHash,
      });
    }

    if (marketLogs.length) {
      const log = marketLogs.at(-1);
      entries.push({
        tone: "watch",
        title: "Market Synced",
        body: `Debt moved to ${formatToken(log.args[2])} mUSDC with health factor ${formatHealth(log.args[3])}.`,
        txHash: log.transactionHash,
      });
    }

    if (!entries.length) {
      ui.activityFeed.innerHTML =
        '<div class="feed-empty">No observed rescue activity yet for this position.</div>';
      return;
    }

    ui.activityFeed.innerHTML = entries
      .map(
        (entry) => `
          <article class="feed-item">
            <div class="feed-item__title">
              <span>${entry.title}</span>
              <span class="status-${entry.tone}">${entry.tone.toUpperCase()}</span>
            </div>
            <div class="feed-item__meta">
              ${entry.body}<br />
              ${txAnchor(entry.txHash, config.networks.sepolia)}
            </div>
          </article>
        `
      )
      .join("");
  } catch (error) {
    ui.activityFeed.innerHTML = `<div class="feed-empty">${friendlyError(error)}</div>`;
  }
}

async function runSepoliaAction(label, callback) {
  try {
    const signer = await ensureSepoliaSigner();
    if (!signer) return;

    const signedContracts = {
      token: new ethers.Contract(config.contracts.token, tokenAbi, signer),
      vault: new ethers.Contract(config.contracts.vault, vaultAbi, signer),
      lendingMarket: new ethers.Contract(config.contracts.lendingMarket, lendingMarketAbi, signer),
      lendingAdapter: new ethers.Contract(config.contracts.lendingAdapter, lendingAdapterAbi, signer),
      executor: new ethers.Contract(config.contracts.executor, executorAbi, signer),
    };

    const { tx } = await callback(signedContracts, state.walletAddress);
    pushActionUpdate(
      `${label} Submitted`,
      "Transaction sent. Waiting for confirmation.",
      txAnchor(tx.hash, config.networks.sepolia)
    );
    await tx.wait();
    pushActionUpdate(
      `${label} Confirmed`,
      "Transaction confirmed on Sepolia.",
      txAnchor(tx.hash, config.networks.sepolia)
    );
    await loadState();
  } catch (error) {
    pushFeed(ui.actionFeed, `${label} Failed`, friendlyError(error), "danger");
  }
}

async function ensureSepoliaSigner() {
  if (!state.browserProvider || !state.walletAddress || !state.signer) {
    await connectWallet();
  }

  if (!state.browserProvider || !state.signer) return null;

  const network = await state.browserProvider.getNetwork();
  if (Number(network.chainId) !== config.networks.sepolia.chainId) {
    pushFeed(
      ui.actionFeed,
      "Wrong Network",
      "Switch your wallet to Ethereum Sepolia before sending write transactions.",
      "watch"
    );
    return null;
  }

  return state.signer;
}

function renderProofLinks() {
  ui.proofLinks.innerHTML = config.proofLinks
    .map(
      (item) => `
        <a class="proof-link" href="${item.url}" target="_blank" rel="noreferrer">
          <span class="proof-link__label">${item.label}</span>
          <span class="proof-link__hash">${shortHash(item.hash)}</span>
        </a>
      `
    )
    .join("");
}

function pushActionUpdate(title, body, linkHtml) {
  pushFeed(ui.actionFeed, title, `${body}${linkHtml ? `<br />${linkHtml}` : ""}`, "safe");
}

function pushFeed(target, title, body, tone) {
  const item = document.createElement("article");
  item.className = "feed-item";
  item.innerHTML = `
    <div class="feed-item__title">
      <span>${title}</span>
      <span class="status-${tone}">${tone.toUpperCase()}</span>
    </div>
    <div class="feed-item__meta">${body}</div>
  `;

  if (target.textContent === "No wallet actions yet.") {
    target.innerHTML = "";
  }

  target.prepend(item);
}

function updateWalletBadge() {
  ui.walletAddress.textContent = state.walletAddress
    ? shortAddress(state.walletAddress)
    : "Not connected";
}

function setHealthBadge(text, tone) {
  ui.healthBadge.textContent = text;
  ui.healthBadge.className = `status-card__value status-${tone}`;
}

function normalizedOwner() {
  const value = ui.ownerInput.value.trim();
  if (!ethers.isAddress(value)) return null;
  return ethers.getAddress(value);
}

function currentPositionId() {
  return positionIdFor(normalizedOwner());
}

function positionIdFor(owner) {
  if (!owner) return null;
  return ethers.keccak256(
    ethers.solidityPacked(["string", "address"], ["backstop-demo", owner])
  );
}

function parseToken(value) {
  return ethers.parseUnits((value || "0").trim(), 6);
}

function parseHealthFactor(value) {
  return ethers.parseUnits((value || "0").trim(), 18);
}

function formatToken(value) {
  return trimNumber(ethers.formatUnits(value ?? 0n, 6), 2);
}

function formatTokenValue(value) {
  return ethers.formatUnits(value ?? 0n, 6);
}

function formatHealth(value) {
  return `${trimNumber(formatHealthValue(value), 2)}x`;
}

function formatHealthValue(value) {
  return ethers.formatUnits(value ?? 0n, 18);
}

function trimNumber(value, decimals) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toFixed(decimals).replace(/\.?0+$/, "");
}

function shortHash(value) {
  if (!value) return "-";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function shortAddress(value) {
  if (!value) return "-";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function txAnchor(txHash, network) {
  return `<a href="${network.explorerTx}${txHash}" target="_blank" rel="noreferrer">${shortHash(
    txHash
  )}</a>`;
}

function friendlyError(error) {
  return error?.shortMessage || error?.reason || error?.message || String(error);
}

function byId(id) {
  return document.getElementById(id);
}
