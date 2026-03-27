import * as ethers from "https://esm.sh/ethers@6.13.5";

const config = {
  demoOwner: "0x5508532b027D57b020e6C0BeDB1fE19a6d6C555c",
  systemContract: "0x0000000000000000000000000000000000fffFfF",
  aavePool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
  usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
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
  contracts: {
    vault: "0x82B78985fC07Bc9868bEd357A9dFF0B710212F6e",
    adapter: "0x6d165fAA504Fdc111a5dBA6651546FFDC87bB8AB",
    executor: "0xc6f2e814f9845FD9404585049aF2147a35943cc6",
    reactive: "0x3C76B3404dd108173952Ff9dD8Bcb58c4ECe945e",
    monitor: "0x93D1ba29FaDC0bA6a8863A9B21C70d6D5Db006dd",
  },
  proofLinks: [
    {
      label: "Aave Risk Borrow",
      hash: "0x4fd985858a73a550e91d4947e1d262046ef0d7c6e7383fee4e2b1af88a04237f",
      network: "sepolia",
    },
    {
      label: "Latest Sync Rerun",
      hash: "0xe3b0138ccdc860365c78e82e04c0818ff6ee24842d302aec7cb98464dff69176",
      network: "sepolia",
    },
    {
      label: "Executor Callback Failure",
      hash: "0xf30bb8470e36c45164221e2d407725f2fe1a588996b2424a70bc3caa005f6016",
      network: "sepolia",
    },
    {
      label: "Latest Replay Protection",
      hash: "0x99ed3c184a4bda32ffbf90b9e5ea29d5d8ec56863ca809778a61dd0c91b6208f",
      network: "sepolia",
    },
    {
      label: "Latest Replay Reserve",
      hash: "0x91b93813d9e5358818aaefde6c7b33e59b0fa5b59556b2edc0d56e1b4ba3a5bb",
      network: "sepolia",
    },
    {
      label: "Backstop Reactive Contract",
      address: "0x3C76B3404dd108173952Ff9dD8Bcb58c4ECe945e",
      network: "lasna",
    },
  ],
};

const vaultAbi = [
  "function positions(bytes32) view returns (address owner, uint256 availableReserve, uint256 committedReserve, uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks, bool active)",
  "function configureProtection(bytes32 positionId, uint256 minHealthFactor, uint256 rescueAmount, uint256 cooldownBlocks)",
  "function depositReserve(bytes32 positionId, uint256 amount)",
];

const adapterAbi = [
  "function getPosition(bytes32) view returns (address user, address debtAsset, address variableDebtToken, bool active)",
  "function syncPosition(bytes32 positionId)",
];

const poolAbi = [
  "function getUserAccountData(address user) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
];

const erc20Abi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const executorAbi = ["function availableLiquidity() view returns (uint256)"];

const reactiveAbi = [
  "function reserveVault() view returns (address)",
  "function lendingAdapter() view returns (address)",
  "function rescueExecutor() view returns (address)",
  "function callbackGasLimit() view returns (uint64)",
];

const monitorAbi = ["function watchedAccounts(address) view returns (bool)"];
const systemAbi = ["function debt(address) view returns (uint256)"];

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
  feed: [],
};

const ui = {
  walletAddress: byId("walletAddress"),
  trackedOwnerBadge: byId("trackedOwnerBadge"),
  healthBadge: byId("healthBadge"),
  lastRefresh: byId("lastRefresh"),
  ownerInput: byId("ownerAddressInput"),
  useConnectedWallet: byId("useConnectedWallet"),
  positionId: byId("positionIdValue"),
  expectedDecision: byId("expectedDecision"),
  vaultLink: byId("vaultLink"),
  adapterLink: byId("adapterLink"),
  executorLink: byId("executorLink"),
  reactiveContractLink: byId("reactiveContractLink"),
  monitorContractLink: byId("monitorContractLink"),
  poolLink: byId("poolLink"),
  metricHealthFactor: byId("metricHealthFactor"),
  metricMinHealthFactor: byId("metricMinHealthFactor"),
  metricDebtOutstanding: byId("metricDebtOutstanding"),
  metricReserveAvailable: byId("metricReserveAvailable"),
  metricReserveCommitted: byId("metricReserveCommitted"),
  metricExecutorLiquidity: byId("metricExecutorLiquidity"),
  metricOwnerBalance: byId("metricOwnerBalance"),
  metricVaultAllowance: byId("metricVaultAllowance"),
  metricCallbackGas: byId("metricCallbackGas"),
  metricBackstopBalance: byId("metricBackstopBalance"),
  metricBackstopDebt: byId("metricBackstopDebt"),
  metricMonitorWatch: byId("metricMonitorWatch"),
  metricMonitorDebt: byId("metricMonitorDebt"),
  minHealthFactorInput: byId("minHealthFactorInput"),
  rescueAmountInput: byId("rescueAmountInput"),
  cooldownBlocksInput: byId("cooldownBlocksInput"),
  connectWallet: byId("connectWallet"),
  switchSepolia: byId("switchSepolia"),
  refreshState: byId("refreshState"),
  replayProtection: byId("replayProtection"),
  replayReserve: byId("replayReserve"),
  syncPosition: byId("syncPosition"),
  proofLinks: byId("proofLinks"),
  activityFeed: byId("activityFeed"),
};

const sepoliaContracts = {
  vault: new ethers.Contract(config.contracts.vault, vaultAbi, state.sepoliaProvider),
  adapter: new ethers.Contract(config.contracts.adapter, adapterAbi, state.sepoliaProvider),
  pool: new ethers.Contract(config.aavePool, poolAbi, state.sepoliaProvider),
  usdc: new ethers.Contract(config.usdc, erc20Abi, state.sepoliaProvider),
  executor: new ethers.Contract(config.contracts.executor, executorAbi, state.sepoliaProvider),
};

const lasnaContracts = {
  reactive: new ethers.Contract(
    config.contracts.reactive,
    reactiveAbi,
    state.lasnaProvider
  ),
  monitor: new ethers.Contract(config.contracts.monitor, monitorAbi, state.lasnaProvider),
  system: new ethers.Contract(config.systemContract, systemAbi, state.lasnaProvider),
};

ui.ownerInput.value = config.demoOwner;
renderStaticLinks();
renderProofLinks();
bindEvents();
loadState().catch((error) => {
  pushFeed("Initial Load Failed", friendlyError(error), "danger");
});

function bindEvents() {
  ui.ownerInput.addEventListener("change", () =>
    loadState().catch((error) => pushFeed("Refresh Failed", friendlyError(error), "danger"))
  );
  ui.refreshState.addEventListener("click", () =>
    loadState().catch((error) => pushFeed("Refresh Failed", friendlyError(error), "danger"))
  );
  ui.connectWallet.addEventListener("click", connectWallet);
  ui.switchSepolia.addEventListener("click", switchToSepolia);
  ui.useConnectedWallet.addEventListener("click", () => {
    if (!state.walletAddress) return;
    ui.ownerInput.value = state.walletAddress;
    loadState().catch((error) => pushFeed("Refresh Failed", friendlyError(error), "danger"));
  });

  ui.replayProtection.addEventListener("click", () =>
    runSepoliaAction("Replay Protection", async (contracts) => {
      const tx = await contracts.vault.configureProtection(
        currentPositionId(),
        parseHealthFactor(ui.minHealthFactorInput.value),
        parseToken(ui.rescueAmountInput.value),
        BigInt(ui.cooldownBlocksInput.value || "0")
      );
      return { tx };
    })
  );

  ui.replayReserve.addEventListener("click", () =>
    runSepoliaAction("Replay Reserve", async (contracts) => {
      const tx = await contracts.vault.depositReserve(currentPositionId(), 0n);
      return { tx };
    })
  );

  ui.syncPosition.addEventListener("click", () =>
    runSepoliaAction("Sync Position", async (contracts) => {
      const tx = await contracts.adapter.syncPosition(currentPositionId());
      return { tx };
    })
  );

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async (accounts) => {
      state.walletAddress = accounts[0] ? ethers.getAddress(accounts[0]) : null;
      state.signer = null;
      updateWalletBadge();
      await loadState().catch((error) =>
        pushFeed("Refresh Failed", friendlyError(error), "danger")
      );
    });
  }
}

async function loadState() {
  const owner = currentOwner();
  const positionId = currentPositionId();

  ui.trackedOwnerBadge.textContent = shortAddress(owner);
  ui.positionId.textContent = positionId;

  const [
    vaultPosition,
    adapterPosition,
    reactiveReserveVault,
    reactiveLendingAdapter,
    reactiveExecutor,
    callbackGasLimit,
    reactiveBalance,
    reactiveDebt,
    monitorWatched,
    monitorDebt,
  ] = await Promise.all([
    sepoliaContracts.vault.positions(positionId),
    sepoliaContracts.adapter.getPosition(positionId),
    lasnaContracts.reactive.reserveVault(),
    lasnaContracts.reactive.lendingAdapter(),
    lasnaContracts.reactive.rescueExecutor(),
    lasnaContracts.reactive.callbackGasLimit(),
    state.lasnaProvider.getBalance(config.contracts.reactive),
    lasnaContracts.system.debt(config.contracts.reactive),
    lasnaContracts.monitor.watchedAccounts(owner),
    lasnaContracts.system.debt(config.contracts.monitor),
  ]);

  let healthFactor = null;
  let debtOutstanding = null;
  let user = ethers.ZeroAddress;
  let variableDebtToken = ethers.ZeroAddress;

  if (adapterPosition[3]) {
    user = adapterPosition[0];
    variableDebtToken = adapterPosition[2];

    const [accountData, variableDebtBalance, executorLiquidity, ownerUsdcBalance, ownerAllowance] =
      await Promise.all([
        sepoliaContracts.pool.getUserAccountData(user),
        new ethers.Contract(variableDebtToken, erc20Abi, state.sepoliaProvider).balanceOf(user),
        sepoliaContracts.executor.availableLiquidity(),
        sepoliaContracts.usdc.balanceOf(owner),
        sepoliaContracts.usdc.allowance(owner, config.contracts.vault),
      ]);

    healthFactor = accountData[5];
    debtOutstanding = variableDebtBalance;

    ui.metricExecutorLiquidity.textContent = formatToken(executorLiquidity);
    ui.metricOwnerBalance.textContent = formatToken(ownerUsdcBalance);
    ui.metricVaultAllowance.textContent = formatToken(ownerAllowance);
  } else {
    ui.metricExecutorLiquidity.textContent = "Unavailable";
    ui.metricOwnerBalance.textContent = "Unavailable";
    ui.metricVaultAllowance.textContent = "Unavailable";
  }

  ui.vaultLink.href = explorerAddressUrl("sepolia", reactiveReserveVault);
  ui.adapterLink.href = explorerAddressUrl("sepolia", reactiveLendingAdapter);
  ui.executorLink.href = explorerAddressUrl("sepolia", reactiveExecutor);
  ui.reactiveContractLink.href = explorerAddressUrl("lasna", config.contracts.reactive);
  ui.monitorContractLink.href = explorerAddressUrl("lasna", config.contracts.monitor);
  ui.poolLink.href = explorerAddressUrl("sepolia", config.aavePool);

  ui.metricHealthFactor.textContent =
    healthFactor === null ? "Unavailable" : formatHealthFactor(healthFactor);
  ui.metricMinHealthFactor.textContent = formatHealthFactor(vaultPosition[3]);
  ui.metricDebtOutstanding.textContent =
    debtOutstanding === null ? "Unavailable" : formatToken(debtOutstanding);
  ui.metricReserveAvailable.textContent = formatToken(vaultPosition[1]);
  ui.metricReserveCommitted.textContent = formatToken(vaultPosition[2]);
  ui.metricCallbackGas.textContent = Number(callbackGasLimit).toLocaleString();
  ui.metricBackstopBalance.textContent = formatEtherValue(reactiveBalance);
  ui.metricBackstopDebt.textContent = formatEtherValue(reactiveDebt);
  ui.metricMonitorWatch.textContent = monitorWatched ? "Yes" : "No";
  ui.metricMonitorDebt.textContent = formatEtherValue(monitorDebt);

  ui.minHealthFactorInput.value = formatHealthFactorInput(vaultPosition[3]);
  ui.rescueAmountInput.value = formatTokenInput(vaultPosition[4]);
  ui.cooldownBlocksInput.value = vaultPosition[5].toString();

  const decision = computeExpectedDecision({
    active: vaultPosition[6],
    minHealthFactor: vaultPosition[3],
    rescueAmount: vaultPosition[4],
    cooldownBlocks: vaultPosition[5],
    availableReserve: vaultPosition[1],
    committedReserve: vaultPosition[2],
    healthFactor,
    debtOutstanding,
    backstopDebt: reactiveDebt,
  });

  ui.expectedDecision.textContent = decision.label;
  setStatus(ui.expectedDecision, decision.label, decision.tone);

  setStatus(
    ui.healthBadge,
    decision.healthLabel,
    decision.tone
  );

  ui.lastRefresh.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  pushFeed(
    "State Refreshed",
    [
      `HF ${healthFactor === null ? "n/a" : formatHealthFactor(healthFactor)}`,
      `reserve ${formatToken(vaultPosition[1])}`,
      `Backstop debt ${formatEtherValue(reactiveDebt)}`,
      `top-level mirror intentionally ignored`,
    ].join(" / "),
    "neutral"
  );

  updateWalletBadge();
}

async function runSepoliaAction(label, fn) {
  try {
    const signer = await requireSepoliaSigner();
    const contracts = {
      vault: new ethers.Contract(config.contracts.vault, vaultAbi, signer),
      adapter: new ethers.Contract(config.contracts.adapter, adapterAbi, signer),
    };

    pushFeed(label, "Transaction submitted to Sepolia.", "watch");
    const { tx } = await fn(contracts);
    pushFeed(label, "Waiting for confirmation.", "watch", {
      label: "View tx",
      href: explorerTxUrl("sepolia", tx.hash),
    });
    await tx.wait();

    pushFeed(label, "Confirmed on Sepolia.", "safe", {
      label: "View tx",
      href: explorerTxUrl("sepolia", tx.hash),
    });
    await loadState();
  } catch (error) {
    pushFeed(label, friendlyError(error), "danger");
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    pushFeed("Wallet", "No browser wallet found.", "danger");
    return;
  }

  state.browserProvider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await state.browserProvider.send("eth_requestAccounts", []);
  state.walletAddress = accounts[0] ? ethers.getAddress(accounts[0]) : null;
  state.signer = state.walletAddress
    ? await state.browserProvider.getSigner()
    : null;

  updateWalletBadge();
  pushFeed("Wallet", "Browser wallet connected.", "safe");
}

async function switchToSepolia() {
  if (!window.ethereum) {
    pushFeed("Network", "No browser wallet found.", "danger");
    return;
  }

  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });

  pushFeed("Network", "Wallet switched to Sepolia.", "safe");
}

async function requireSepoliaSigner() {
  if (!state.browserProvider || !state.signer) {
    await connectWallet();
  }

  const network = await state.browserProvider.getNetwork();
  if (Number(network.chainId) !== config.networks.sepolia.chainId) {
    await switchToSepolia();
    state.signer = await state.browserProvider.getSigner();
  }

  return state.signer;
}

function currentOwner() {
  return ethers.getAddress(ui.ownerInput.value.trim() || config.demoOwner);
}

function currentPositionId() {
  return ethers.solidityPackedKeccak256(
    ["string", "address"],
    ["backstop-demo", currentOwner()]
  );
}

function renderStaticLinks() {
  ui.vaultLink.href = explorerAddressUrl("sepolia", config.contracts.vault);
  ui.adapterLink.href = explorerAddressUrl("sepolia", config.contracts.adapter);
  ui.executorLink.href = explorerAddressUrl("sepolia", config.contracts.executor);
  ui.reactiveContractLink.href = explorerAddressUrl("lasna", config.contracts.reactive);
  ui.monitorContractLink.href = explorerAddressUrl("lasna", config.contracts.monitor);
  ui.poolLink.href = explorerAddressUrl("sepolia", config.aavePool);
}

function renderProofLinks() {
  ui.proofLinks.innerHTML = "";

  for (const item of config.proofLinks) {
    const anchor = document.createElement("a");
    anchor.className = "proof-link";
    anchor.target = "_blank";
    anchor.rel = "noreferrer";

    const label = document.createElement("span");
    label.className = "proof-link__label";
    label.textContent = item.label;

    const hash = document.createElement("span");
    hash.className = "proof-link__hash";

    if (item.hash) {
      anchor.href = explorerTxUrl(item.network, item.hash);
      hash.textContent = shortHash(item.hash);
    } else {
      anchor.href = explorerAddressUrl(item.network, item.address);
      hash.textContent = shortAddress(item.address);
    }

    anchor.append(label, hash);
    ui.proofLinks.append(anchor);
  }
}

function pushFeed(title, body, tone = "neutral", link = null) {
  state.feed.unshift({
    title,
    body,
    tone,
    link,
    at: new Date(),
  });
  state.feed = state.feed.slice(0, 10);
  renderFeed();
}

function renderFeed() {
  ui.activityFeed.innerHTML = "";

  if (!state.feed.length) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.textContent = "No activity yet.";
    ui.activityFeed.append(empty);
    return;
  }

  for (const item of state.feed) {
    const entry = document.createElement("article");
    entry.className = "feed-item";

    const title = document.createElement("div");
    title.className = `feed-item__title ${statusClass(item.tone)}`;
    title.textContent = item.title;

    const body = document.createElement("div");
    body.textContent = item.body;

    const meta = document.createElement("div");
    meta.className = "feed-item__meta";

    const parts = [
      item.at.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    ];

    if (item.link) {
      const anchor = document.createElement("a");
      anchor.href = item.link.href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = item.link.label;
      meta.append(anchor);
      meta.append(document.createTextNode(" / "));
    }

    meta.append(parts.join(" / "));
    entry.append(title, body, meta);
    ui.activityFeed.append(entry);
  }
}

function computeExpectedDecision({
  active,
  minHealthFactor,
  rescueAmount,
  availableReserve,
  healthFactor,
  debtOutstanding,
  backstopDebt,
}) {
  if (!active) {
    return { label: "Inactive", healthLabel: "Inactive", tone: "watch" };
  }

  if (healthFactor === null || debtOutstanding === null) {
    return { label: "Waiting For Sync", healthLabel: "Waiting For Sync", tone: "watch" };
  }

  if (backstopDebt > 0n) {
    return { label: "Blocked By Lasna Debt", healthLabel: "Blocked By Lasna Debt", tone: "danger" };
  }

  if (healthFactor > minHealthFactor) {
    return { label: "Healthy", healthLabel: "Healthy", tone: "safe" };
  }

  if (availableReserve < rescueAmount || availableReserve === 0n) {
    return { label: "Reserve Too Low", healthLabel: "Reserve Too Low", tone: "danger" };
  }

  return { label: "Trigger Ready", healthLabel: "Trigger Ready", tone: "danger" };
}

function updateWalletBadge() {
  ui.walletAddress.textContent = state.walletAddress
    ? shortAddress(state.walletAddress)
    : "Not connected";
}

function setStatus(element, text, tone) {
  element.textContent = text;
  element.classList.remove("status-safe", "status-watch", "status-danger");
  element.classList.add(statusClass(tone));
}

function statusClass(tone) {
  if (tone === "safe") return "status-safe";
  if (tone === "danger") return "status-danger";
  return "status-watch";
}

function explorerTxUrl(networkKey, hash) {
  return `${config.networks[networkKey].explorerTx}${hash}`;
}

function explorerAddressUrl(networkKey, address) {
  return `${config.networks[networkKey].explorerAddress}${address}`;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatToken(value) {
  return `${Number(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })} USDC`;
}

function formatTokenInput(value) {
  return Number(ethers.formatUnits(value, 6)).toString();
}

function formatHealthFactor(value) {
  return Number(ethers.formatUnits(value, 18)).toFixed(3);
}

function formatHealthFactorInput(value) {
  return Number(ethers.formatUnits(value, 18)).toString();
}

function formatEtherValue(value) {
  return `${Number(ethers.formatEther(value)).toFixed(6)} REACT`;
}

function parseToken(value) {
  return ethers.parseUnits((value || "0").trim(), 6);
}

function parseHealthFactor(value) {
  return ethers.parseUnits((value || "0").trim(), 18);
}

function friendlyError(error) {
  const message =
    error?.shortMessage ||
    error?.reason ||
    error?.message ||
    "Unexpected failure";
  return message.replace(/^execution reverted: /i, "");
}

function byId(id) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element;
}
