const { useEffect, useMemo, useRef, useState } = React;
const { createRoot } = ReactDOM;

const CONFIG = {
  demoOwner: "0x5508532b027D57b020e6C0BeDB1fE19a6d6C555c",
  systemContract: "0x0000000000000000000000000000000000fffFfF",
  aavePool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
  usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
  positionSalt: "backstop-demo",
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
    vault: "0x5C3C4593a23040a2b069Bc4DdF6eD95b4D11dc3d",
    adapter: "0xffB6ebd0ab6730F43980218eA43727Acc90D7906",
    executor: "0x14B4AFBc9677f1AF954c3B4f9a5152bb2c31981a",
    reactive: "0xEC11dB01703C90055c9bD382d7DB74DeD6DD08C8",
    monitor: "0xC61Ac5bD830858A5Cee607D2bDE2D472824b3a06",
  },
  proofRows: [
    {
      id: "sync",
      label: "Trigger Sync",
      hash: "0x5ddf2ecf3ec382e42cccdae2879d231f550ffaf83629813bf7614455f9cc6ece",
      network: "sepolia",
      status: "success",
      detail: "Fresh syncPosition emitted the rescue-triggering health update.",
    },
    {
      id: "reserve",
      label: "Reserve Commit",
      hash: "0xbdb2de69ed59aae282eec72f3390c5380330864b3c8a12a4001097cfcc232d7c",
      network: "sepolia",
      status: "success",
      detail: "Reactive callback committed 50 USDC in the vault.",
    },
    {
      id: "rescue",
      label: "Rescue Execute",
      hash: "0x1859c3b12093a21db8dbb351bc36f45070a281c029335996bf5e5efec3ab4242",
      network: "sepolia",
      status: "success",
      detail: "Executor repaid live Aave debt on Sepolia.",
    },
    {
      id: "protect",
      label: "Configure Protection",
      hash: "0x69bb36dce12b37c4f3fca38d2a834fc691d908fe160c0b70020fd17fd1b5e008",
      network: "sepolia",
      status: "success",
      detail: "Backstop protection policy seeded on the live clean stack.",
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
  "function getLiveHealthFactor(bytes32) view returns (uint256)",
  "function getLiveDebtOutstanding(bytes32) view returns (uint256)",
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

const sepoliaProvider = new ethers.JsonRpcProvider(
  CONFIG.networks.sepolia.rpc,
  CONFIG.networks.sepolia.chainId
);
const lasnaProvider = new ethers.JsonRpcProvider(
  CONFIG.networks.lasna.rpc,
  CONFIG.networks.lasna.chainId
);

const sepoliaContracts = {
  vault: new ethers.Contract(CONFIG.contracts.vault, vaultAbi, sepoliaProvider),
  adapter: new ethers.Contract(CONFIG.contracts.adapter, adapterAbi, sepoliaProvider),
  pool: new ethers.Contract(CONFIG.aavePool, poolAbi, sepoliaProvider),
  usdc: new ethers.Contract(CONFIG.usdc, erc20Abi, sepoliaProvider),
  executor: new ethers.Contract(CONFIG.contracts.executor, executorAbi, sepoliaProvider),
};

const lasnaContracts = {
  reactive: new ethers.Contract(CONFIG.contracts.reactive, reactiveAbi, lasnaProvider),
  monitor: new ethers.Contract(CONFIG.contracts.monitor, monitorAbi, lasnaProvider),
  system: new ethers.Contract(CONFIG.systemContract, systemAbi, lasnaProvider),
};

const TABS = [
  { id: "overview", label: "Overview", icon: "◉" },
  { id: "reserve", label: "Reserve", icon: "◇" },
  { id: "policy", label: "Policy", icon: "⚙" },
  { id: "history", label: "History", icon: "↻" },
];

function shortAddress(address) {
  if (!address || address === ethers.ZeroAddress) return "Unavailable";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function explorerTxUrl(networkKey, hash) {
  return `${CONFIG.networks[networkKey].explorerTx}${hash}`;
}

function explorerAddressUrl(networkKey, address) {
  return `${CONFIG.networks[networkKey].explorerAddress}${address}`;
}

function formatToken(value) {
  if (value === null || value === undefined) return "--";
  return Number(ethers.formatUnits(value, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatTokenWithUnit(value) {
  return `${formatToken(value)} USDC`;
}

function formatEtherValue(value) {
  if (value === null || value === undefined) return "--";
  return Number(ethers.formatEther(value)).toFixed(6);
}

function formatHealthFactor(value) {
  if (value === null || value === undefined) return "--";
  return Number(ethers.formatUnits(value, 18)).toFixed(3);
}

function formatHealthFactorInput(value) {
  if (value === null || value === undefined) return "1.15";
  return Number(ethers.formatUnits(value, 18)).toString();
}

function formatTokenInput(value) {
  if (value === null || value === undefined) return "25";
  return Number(ethers.formatUnits(value, 6)).toString();
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

function computePositionId(owner) {
  return ethers.solidityPackedKeccak256(
    ["string", "address"],
    [CONFIG.positionSalt, owner]
  );
}

function hfColor(hfNumber) {
  if (hfNumber >= 1.5) return "#00ffaa";
  if (hfNumber >= 1.25) return "#a8e06c";
  if (hfNumber >= 1.1) return "#ffb347";
  return "#ff4d6a";
}

function hfLabel(hfNumber) {
  if (hfNumber >= 1.5) return "Healthy";
  if (hfNumber >= 1.25) return "Protected";
  if (hfNumber >= 1.1) return "At Risk";
  return "Critical";
}

function computeDecision(live) {
  if (!live) {
    return {
      label: "Loading",
      summary: "Loading live protection state.",
      tone: "watch",
    };
  }

  if (!live.active) {
    return {
      label: "Inactive",
      summary: "Protection is not enabled for this position.",
      tone: "watch",
    };
  }

  if (!live.positionActive) {
    return {
      label: "Waiting For Sync",
      summary: "The adapter is not tracking a live Aave borrower yet.",
      tone: "watch",
    };
  }

  if (live.backstopDebt > 0n) {
    return {
      label: "Blocked By Lasna Debt",
      summary: "Reactive automation is paused by unpaid Lasna system debt.",
      tone: "danger",
    };
  }

  if (live.healthFactor > live.minHealthFactor) {
    return {
      label: "Healthy",
      summary: "The live health factor is still above the protection threshold.",
      tone: "safe",
    };
  }

  if (live.availableReserve === 0n || live.availableReserve < live.rescueAmount) {
    return {
      label: "Reserve Too Low",
      summary: "The vault does not have enough available reserve to fire another rescue.",
      tone: "danger",
    };
  }

  return {
    label: "Trigger Ready",
    summary: "The next sync can post reserve and rescue callbacks immediately.",
    tone: "danger",
  };
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        padding: "16px 18px",
        flex: "1 1 160px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: accent || "#fff",
          fontFamily: "'Outfit', sans-serif",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.35)",
            marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
            wordBreak: "break-word",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function PulsingDot({ color = "#00ffaa", size = 8 }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: color,
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          border: `1px solid ${color}`,
          animation: "pulse-ring 2s ease-in-out infinite",
          opacity: 0.4,
        }}
      />
    </span>
  );
}

function HealthGauge({ hf, threshold, liqThreshold }) {
  const safeHf = Math.max(hf || 0, 0.8);
  const angle = Math.min(Math.max((safeHf - 0.8) / (2.0 - 0.8), 0), 1) * 180;
  const threshAngle = ((threshold - 0.8) / (2.0 - 0.8)) * 180;
  const liqAngle = ((liqThreshold - 0.8) / (2.0 - 0.8)) * 180;
  const color = hfColor(safeHf);

  return (
    <div
      style={{
        position: "relative",
        width: 240,
        height: 140,
        margin: "0 auto",
        maxWidth: "100%",
      }}
    >
      <svg viewBox="0 0 240 140" width="240" height="140">
        <defs>
          <linearGradient id="arcBg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff4d6a" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#ffb347" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#00ffaa" stopOpacity="0.15" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={describeArc(120, 125, 95, 180, 360)}
          fill="none"
          stroke="url(#arcBg)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d={describeArc(120, 125, 95, 180, 180 + angle)}
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          filter="url(#glow)"
          opacity="0.92"
        />
        {[
          { a: threshAngle, c: "#a8e06c", label: "P" },
          { a: liqAngle, c: "#ff4d6a", label: "L" },
        ].map((marker) => {
          const rad = ((180 + marker.a) * Math.PI) / 180;
          const x = 120 + 95 * Math.cos(rad);
          const y = 125 + 95 * Math.sin(rad);

          return (
            <g key={marker.label}>
              <circle cx={x} cy={y} r="4" fill={marker.c} opacity="0.7" />
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fill={marker.c}
                fontSize="9"
                fontFamily="'JetBrains Mono', monospace"
                opacity="0.6"
              >
                {marker.label}
              </text>
            </g>
          );
        })}
        <text
          x="120"
          y="105"
          textAnchor="middle"
          fill={color}
          fontSize="36"
          fontWeight="700"
          fontFamily="'Outfit', sans-serif"
          filter="url(#glow)"
        >
          {hf.toFixed(2)}
        </text>
        <text
          x="120"
          y="125"
          textAnchor="middle"
          fill={color}
          fontSize="11"
          fontFamily="'JetBrains Mono', monospace"
          opacity="0.7"
        >
          {hfLabel(hf).toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

function ReserveBar({ allocated, available, total }) {
  const allocPct = total > 0 ? (allocated / total) * 100 : 0;
  const availPct = total > 0 ? (available / total) * 100 : 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          RESERVE UTILIZATION
        </span>
        <span
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {total.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
        </span>
      </div>
      <div
        style={{
          height: 10,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 5,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            width: `${allocPct}%`,
            background: "linear-gradient(90deg, #6c5ce7, #a29bfe)",
            borderRadius: "5px 0 0 5px",
            transition: "width 0.6s ease",
          }}
        />
        <div
          style={{
            width: `${availPct}%`,
            background: "linear-gradient(90deg, #00cec9, #00ffaa)",
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "#a29bfe",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          ● Committed: {allocated.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#00ffaa",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          ● Available: {available.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

function EventFeed({ entries }) {
  if (!entries.length) {
    return (
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.38)",
          fontFamily: "'JetBrains Mono', monospace",
          padding: "12px 0",
        }}
      >
        Waiting for state refresh.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((entry, index) => (
        <div
          key={`${entry.title}-${index}`}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 0",
            borderBottom:
              index < entries.length - 1
                ? "1px solid rgba(255,255,255,0.04)"
                : "none",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color:
                entry.tone === "safe"
                  ? "#00ffaa"
                  : entry.tone === "danger"
                    ? "#ff4d6a"
                    : "#ffb347",
              width: 18,
              textAlign: "center",
            }}
          >
            {entry.tone === "safe" ? "◆" : entry.tone === "danger" ? "▲" : "◇"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.88)",
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: 2,
              }}
            >
              {entry.title}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.62)",
                fontFamily: "'JetBrains Mono', monospace",
                wordBreak: "break-word",
              }}
            >
              {entry.body}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.38)",
              fontFamily: "'JetBrains Mono', monospace",
              whiteSpace: "nowrap",
            }}
          >
            {entry.time}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProofRow({ row }) {
  const accent = row.status === "success" ? "#00ffaa" : "#ffb347";
  return (
    <a
      href={explorerTxUrl(row.network, row.hash)}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.9fr) auto",
        gap: 14,
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.82)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {row.label}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            marginTop: 4,
          }}
        >
          {row.detail}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.64)",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {shortHash(row.hash)}
      </div>
      <span
        style={{
          fontSize: 10,
          background: "rgba(0,255,170,0.1)",
          color: accent,
          padding: "4px 9px",
          borderRadius: 999,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {row.status}
      </span>
    </a>
  );
}

function LinkPill({ href, label, value }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "rgba(255,255,255,0.36)",
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color: "rgba(255,255,255,0.78)",
          fontFamily: "'JetBrains Mono', monospace",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </a>
  );
}

function ActionButton({ label, onClick, variant = "secondary", disabled = false }) {
  const accent =
    variant === "primary"
      ? {
          background: "linear-gradient(135deg, #6c5ce7, #00ffaa)",
          color: "#0a0b0f",
          border: "none",
        }
      : {
          background: "rgba(255,255,255,0.05)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
        };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...accent,
        padding: "12px 16px",
        borderRadius: 10,
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        letterSpacing: "0.04em",
        width: "100%",
      }}
    >
      {label}
    </button>
  );
}

function OverviewTab({ live, feedEntries, decision, contractLinks, onRefresh }) {
  const hfNumber = live?.healthFactor
    ? Number(ethers.formatUnits(live.healthFactor, 18))
    : 1.0;
  const minHealthFactor = live?.minHealthFactor
    ? Number(ethers.formatUnits(live.minHealthFactor, 18))
    : 1.15;
  const totalReserve =
    live === null
      ? 0
      : Number(ethers.formatUnits(live.availableReserve + live.committedReserve, 6));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="layout-two">
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 28,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${hfColor(hfNumber)}, transparent)`,
              opacity: 0.6,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Health Factor
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.25)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginTop: 4,
                }}
              >
                Aave V3 · Ethereum Sepolia
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background:
                  decision.tone === "safe"
                    ? "rgba(0,255,170,0.08)"
                    : decision.tone === "danger"
                      ? "rgba(255,77,106,0.08)"
                      : "rgba(255,179,71,0.08)",
                padding: "4px 10px",
                borderRadius: 999,
              }}
            >
              <PulsingDot
                color={
                  decision.tone === "safe"
                    ? "#00ffaa"
                    : decision.tone === "danger"
                      ? "#ff4d6a"
                      : "#ffb347"
                }
                size={6}
              />
              <span
                style={{
                  fontSize: 10,
                  color:
                    decision.tone === "safe"
                      ? "#00ffaa"
                      : decision.tone === "danger"
                        ? "#ff4d6a"
                        : "#ffb347",
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: "uppercase",
                }}
              >
                {decision.label}
              </span>
            </div>
          </div>
          <HealthGauge
            hf={hfNumber}
            threshold={minHealthFactor}
            liqThreshold={1.0}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ color: "#ff4d6a" }}>L</span> Liquidation: 1.00
            </span>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span style={{ color: "#a8e06c" }}>P</span> Protection: {minHealthFactor.toFixed(2)}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: 24,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 16,
              }}
            >
              Position
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 18,
                marginBottom: 14,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: 4,
                  }}
                >
                  COLLATERAL VALUE
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
                  ${live ? live.totalCollateralUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--"}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Aave account value
                </div>
              </div>
              <div
                style={{
                  width: 1,
                  background: "rgba(255,255,255,0.06)",
                  flexShrink: 0,
                }}
              />
              <div style={{ textAlign: "right", minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: 4,
                  }}
                >
                  LIVE DEBT
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#ff6b8a" }}>
                  {live ? formatToken(live.debtOutstanding) : "--"}{" "}
                  <span
                    style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}
                  >
                    USDC
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  ${live ? live.totalDebtUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "--"}
                </div>
              </div>
            </div>
            <div
              style={{
                height: 1,
                background: "rgba(255,255,255,0.04)",
                margin: "4px 0 14px",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Owner
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {live ? shortAddress(live.owner) : "--"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="layout-two">
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Reserve Vault
            </div>
            <ActionButton label="Refresh State" onClick={onRefresh} />
          </div>
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <StatCard
              label="Available"
              value={live ? formatToken(live.availableReserve) : "--"}
              sub="USDC"
              accent="#00ffaa"
            />
            <StatCard
              label="Committed"
              value={live ? formatToken(live.committedReserve) : "--"}
              sub="USDC"
              accent="#a29bfe"
            />
          </div>
          <ReserveBar
            allocated={live ? Number(ethers.formatUnits(live.committedReserve, 6)) : 0}
            available={live ? Number(ethers.formatUnits(live.availableReserve, 6)) : 0}
            total={totalReserve}
          />
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                fontFamily: "'JetBrains Mono', monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Live Feed
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <PulsingDot color="#00ffaa" size={5} />
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Sepolia + Lasna
              </span>
            </div>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <EventFeed entries={feedEntries} />
          </div>
        </div>
      </div>

      <div className="stat-row">
        <StatCard
          label="Automation"
          value={decision.label}
          sub={decision.summary}
          accent={
            decision.tone === "safe"
              ? "#00ffaa"
              : decision.tone === "danger"
                ? "#ff4d6a"
                : "#ffb347"
          }
        />
        <StatCard
          label="Backstop Debt"
          value={live ? `${formatEtherValue(live.backstopDebt)} REACT` : "--"}
          sub="Reactive system debt"
          accent="#ffb347"
        />
        <StatCard
          label="Executor"
          value={live ? `${formatToken(live.executorLiquidity)} USDC` : "--"}
          sub="available liquidity"
          accent="#a29bfe"
        />
        <StatCard
          label="Monitor"
          value={live ? (live.monitorWatched ? "Watching" : "Idle") : "--"}
          sub="Aave account watcher"
          accent="rgba(255,255,255,0.72)"
        />
      </div>

      <div className="link-grid">
        {contractLinks.map((link) => (
          <LinkPill key={link.label} href={link.href} label={link.label} value={link.value} />
        ))}
      </div>
    </div>
  );
}

function ReserveTab({
  live,
  ownerInput,
  setOwnerInput,
  walletAddress,
  connectWallet,
  switchSepolia,
  useConnectedWallet,
  refreshState,
  actionInputs,
  setActionInputs,
  runReplayProtection,
  runReplayReserve,
  runSyncPosition,
  loadingAction,
}) {
  const totalReserve =
    live === null
      ? 0
      : Number(ethers.formatUnits(live.availableReserve + live.committedReserve, 6));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 20,
          }}
        >
          Reserve Vault · Ethereum Sepolia
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <StatCard
            label="Total Balance"
            value={live ? formatToken(live.availableReserve + live.committedReserve) : "--"}
            sub="USDC"
            accent="#fff"
          />
          <StatCard
            label="Committed"
            value={live ? formatToken(live.committedReserve) : "--"}
            sub="USDC"
            accent="#a29bfe"
          />
          <StatCard
            label="Available"
            value={live ? formatToken(live.availableReserve) : "--"}
            sub="USDC"
            accent="#00ffaa"
          />
        </div>
        <ReserveBar
          allocated={live ? Number(ethers.formatUnits(live.committedReserve, 6)) : 0}
          available={live ? Number(ethers.formatUnits(live.availableReserve, 6)) : 0}
          total={totalReserve}
        />
      </div>

      <div className="layout-two">
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            Operator Controls
          </div>

          <div className="field-grid">
            <div>
              <label className="field-label">Tracked Owner</label>
              <input
                className="control-input"
                value={ownerInput}
                onChange={(event) => setOwnerInput(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Connected Wallet</label>
              <div className="value-pill">{walletAddress ? shortAddress(walletAddress) : "Not connected"}</div>
            </div>
          </div>

          <div className="button-grid">
            <ActionButton
              label={walletAddress ? shortAddress(walletAddress) : "Connect Wallet"}
              onClick={connectWallet}
              variant={walletAddress ? "secondary" : "primary"}
            />
            <ActionButton label="Switch To Sepolia" onClick={switchSepolia} />
            <ActionButton
              label="Use Connected Wallet"
              onClick={useConnectedWallet}
              disabled={!walletAddress}
            />
            <ActionButton label="Refresh State" onClick={refreshState} />
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            padding: 28,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 16,
            }}
          >
            Replay + Sync
          </div>

          <div className="field-grid">
            <div>
              <label className="field-label">Min HF</label>
              <input
                className="control-input"
                value={actionInputs.minHealthFactor}
                onChange={(event) =>
                  setActionInputs((current) => ({
                    ...current,
                    minHealthFactor: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="field-label">Rescue Amount</label>
              <input
                className="control-input"
                value={actionInputs.rescueAmount}
                onChange={(event) =>
                  setActionInputs((current) => ({
                    ...current,
                    rescueAmount: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="field-label">Cooldown Blocks</label>
              <input
                className="control-input"
                value={actionInputs.cooldownBlocks}
                onChange={(event) =>
                  setActionInputs((current) => ({
                    ...current,
                    cooldownBlocks: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="button-grid">
            <ActionButton
              label={loadingAction === "Replay Protection" ? "Replaying..." : "Replay Protection"}
              onClick={runReplayProtection}
              disabled={loadingAction !== null}
            />
            <ActionButton
              label={loadingAction === "Replay Reserve" ? "Replaying..." : "Replay Reserve"}
              onClick={runReplayReserve}
              disabled={loadingAction !== null}
            />
            <ActionButton
              label={loadingAction === "Sync Position" ? "Syncing..." : "Sync Position"}
              onClick={runSyncPosition}
              variant="primary"
              disabled={loadingAction !== null}
            />
          </div>

          <div className="note-block">
            These buttons hit the live Sepolia contracts. They require a connected wallet, Sepolia
            network selection, and ownership of the tracked position.
          </div>
        </div>
      </div>
    </div>
  );
}

function PolicyTab({ live, decision, positionId, contractLinks }) {
  if (!live) {
    return null;
  }

  const rows = [
    {
      label: "Trigger Threshold",
      value: `HF < ${formatHealthFactor(live.minHealthFactor)}`,
      desc: "Reactive rescue logic fires only below this minimum health factor.",
    },
    {
      label: "Rescue Amount",
      value: `${formatToken(live.rescueAmount)} USDC`,
      desc: "Maximum debt repayment requested per rescue execution.",
    },
    {
      label: "Cooldown",
      value: `${live.cooldownBlocks.toString()} blocks`,
      desc: "Minimum block delay before a position can trigger again.",
    },
    {
      label: "Callback Gas",
      value: `${live.callbackGasLimit.toLocaleString()} gas`,
      desc: "Configured callback budget for the live Sepolia rescue path.",
    },
    {
      label: "Watcher Status",
      value: live.monitorWatched ? "Watching account" : "Not watching",
      desc: "Lasna Aave monitor subscription state for the tracked borrower.",
    },
    {
      label: "Reactive Debt",
      value: `${formatEtherValue(live.backstopDebt)} REACT`,
      desc: "Outstanding Lasna system debt on the Backstop reactive contract.",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          background:
            decision.tone === "safe"
              ? "rgba(0,255,170,0.04)"
              : decision.tone === "danger"
                ? "rgba(255,77,106,0.06)"
                : "rgba(255,179,71,0.06)",
          border: `1px solid ${
            decision.tone === "safe"
              ? "rgba(0,255,170,0.1)"
              : decision.tone === "danger"
                ? "rgba(255,77,106,0.15)"
                : "rgba(255,179,71,0.15)"
          }`,
          borderRadius: 12,
          padding: "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PulsingDot
            color={
              decision.tone === "safe"
                ? "#00ffaa"
                : decision.tone === "danger"
                  ? "#ff4d6a"
                  : "#ffb347"
            }
            size={7}
          />
          <span
            style={{
              fontSize: 13,
              color:
                decision.tone === "safe"
                  ? "#00ffaa"
                  : decision.tone === "danger"
                    ? "#ff4d6a"
                    : "#ffb347",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {decision.label}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
            fontFamily: "'JetBrains Mono', monospace",
            wordBreak: "break-all",
          }}
        >
          {positionId}
        </div>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 20,
          }}
        >
          Protection Policy
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((row, index) => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 18,
                padding: "12px 0",
                borderBottom:
                  index < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.7)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {row.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.25)",
                    marginTop: 3,
                  }}
                >
                  {row.desc}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#fff",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  textAlign: "right",
                }}
              >
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="link-grid">
        {contractLinks.map((link) => (
          <LinkPill key={link.label} href={link.href} label={link.label} value={link.value} />
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ proofRows, feedEntries }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="stat-row">
        <StatCard label="Proof Transactions" value={proofRows.length} accent="#a29bfe" />
        <StatCard label="End-to-End Rescue" value="Completed" accent="#00ffaa" />
        <StatCard label="Reserve Commit" value="50 USDC" accent="#ffb347" />
        <StatCard label="Debt Repaid" value="25 USDC" accent="#00ffaa" />
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 28,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          Public Proof Set
        </div>
        {proofRows.map((row) => (
          <ProofRow key={row.id} row={row} />
        ))}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'JetBrains Mono', monospace",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 12,
          }}
        >
          Session Activity
        </div>
        <EventFeed entries={feedEntries} />
      </div>
    </div>
  );
}

function BackstopDashboard() {
  const [tab, setTab] = useState("overview");
  const [live, setLive] = useState(null);
  const [ownerInput, setOwnerInput] = useState(CONFIG.demoOwner);
  const [walletAddress, setWalletAddress] = useState(null);
  const [browserProvider, setBrowserProvider] = useState(null);
  const [actionInputs, setActionInputs] = useState({
    minHealthFactor: "1.15",
    rescueAmount: "25",
    cooldownBlocks: "25",
  });
  const [loadingState, setLoadingState] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [feedEntries, setFeedEntries] = useState([]);
  const bootedRef = useRef(false);

  const normalizedOwner = useMemo(() => {
    try {
      return ethers.getAddress(ownerInput.trim());
    } catch {
      return CONFIG.demoOwner;
    }
  }, [ownerInput]);

  const positionId = useMemo(
    () => computePositionId(normalizedOwner),
    [normalizedOwner]
  );

  const decision = useMemo(() => computeDecision(live), [live]);

  const contractLinks = useMemo(
    () => [
      {
        label: "Vault",
        value: shortAddress(CONFIG.contracts.vault),
        href: explorerAddressUrl("sepolia", CONFIG.contracts.vault),
      },
      {
        label: "Adapter",
        value: shortAddress(CONFIG.contracts.adapter),
        href: explorerAddressUrl("sepolia", CONFIG.contracts.adapter),
      },
      {
        label: "Executor",
        value: shortAddress(CONFIG.contracts.executor),
        href: explorerAddressUrl("sepolia", CONFIG.contracts.executor),
      },
      {
        label: "Reactive",
        value: shortAddress(CONFIG.contracts.reactive),
        href: explorerAddressUrl("lasna", CONFIG.contracts.reactive),
      },
      {
        label: "Monitor",
        value: shortAddress(CONFIG.contracts.monitor),
        href: explorerAddressUrl("lasna", CONFIG.contracts.monitor),
      },
      {
        label: "Aave Pool",
        value: shortAddress(CONFIG.aavePool),
        href: explorerAddressUrl("sepolia", CONFIG.aavePool),
      },
    ],
    []
  );

  function pushFeed(title, body, tone = "watch") {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setFeedEntries((current) => [{ title, body, tone, time }, ...current].slice(0, 10));
  }

  async function syncWalletState({ request = false, announce = false } = {}) {
    if (!window.ethereum) {
      if (announce) {
        pushFeed("Wallet", "No browser wallet found.", "danger");
      }
      return null;
    }

    const provider = browserProvider || new ethers.BrowserProvider(window.ethereum);
    if (!browserProvider) {
      setBrowserProvider(provider);
    }

    const method = request ? "eth_requestAccounts" : "eth_accounts";
    const accounts = await provider.send(method, []);
    const nextWallet = accounts[0] ? ethers.getAddress(accounts[0]) : null;

    setWalletAddress((current) => {
      if (current === nextWallet) {
        return current;
      }
      return nextWallet;
    });

    if (announce) {
      pushFeed(
        "Wallet",
        nextWallet
          ? `Connected ${shortAddress(nextWallet)}`
          : "No wallet account is currently authorized.",
        nextWallet ? "safe" : "watch"
      );
    }

    return { provider, walletAddress: nextWallet };
  }

  async function loadState({ silent = false } = {}) {
    try {
      if (!silent) {
        setLoadingState(true);
      }

      const [
        vaultPosition,
        adapterPosition,
        callbackGasLimit,
        reactiveBalance,
        backstopDebt,
        monitorWatched,
        monitorDebt,
      ] = await Promise.all([
        sepoliaContracts.vault.positions(positionId),
        sepoliaContracts.adapter.getPosition(positionId),
        lasnaContracts.reactive.callbackGasLimit(),
        lasnaProvider.getBalance(CONFIG.contracts.reactive),
        lasnaContracts.system.debt(CONFIG.contracts.reactive),
        lasnaContracts.monitor.watchedAccounts(normalizedOwner),
        lasnaContracts.system.debt(CONFIG.contracts.monitor),
      ]);

      let totalCollateralUsd = 0;
      let totalDebtUsd = 0;
      let healthFactor = null;
      let debtOutstanding = null;
      let ownerUsdcBalance = null;
      let vaultAllowance = null;
      let executorLiquidity = null;
      let positionUser = adapterPosition[0];

      if (adapterPosition[3]) {
        const [accountData, liveHealthFactor, liveDebtOutstanding, liquidity, ownerBalance, allowance] =
          await Promise.all([
            sepoliaContracts.pool.getUserAccountData(positionUser),
            sepoliaContracts.adapter.getLiveHealthFactor(positionId),
            sepoliaContracts.adapter.getLiveDebtOutstanding(positionId),
            sepoliaContracts.executor.availableLiquidity(),
            sepoliaContracts.usdc.balanceOf(normalizedOwner),
            sepoliaContracts.usdc.allowance(normalizedOwner, CONFIG.contracts.vault),
          ]);

        totalCollateralUsd = Number(accountData[0]) / 1e8;
        totalDebtUsd = Number(accountData[1]) / 1e8;
        healthFactor = liveHealthFactor;
        debtOutstanding = liveDebtOutstanding;
        ownerUsdcBalance = ownerBalance;
        vaultAllowance = allowance;
        executorLiquidity = liquidity;
      }

      const nextLive = {
        owner: vaultPosition[0],
        availableReserve: vaultPosition[1],
        committedReserve: vaultPosition[2],
        minHealthFactor: vaultPosition[3],
        rescueAmount: vaultPosition[4],
        cooldownBlocks: vaultPosition[5],
        active: vaultPosition[6],
        positionUser,
        debtAsset: adapterPosition[1],
        variableDebtToken: adapterPosition[2],
        positionActive: adapterPosition[3],
        totalCollateralUsd,
        totalDebtUsd,
        healthFactor,
        debtOutstanding,
        ownerUsdcBalance,
        vaultAllowance,
        executorLiquidity,
        callbackGasLimit: Number(callbackGasLimit),
        reactiveBalance,
        backstopDebt,
        monitorWatched,
        monitorDebt,
      };

      setLive(nextLive);
      setActionInputs({
        minHealthFactor: formatHealthFactorInput(nextLive.minHealthFactor),
        rescueAmount: formatTokenInput(nextLive.rescueAmount),
        cooldownBlocks: nextLive.cooldownBlocks.toString(),
      });

      pushFeed(
        "State Refreshed",
        `HF ${formatHealthFactor(nextLive.healthFactor)} / reserve ${formatToken(nextLive.availableReserve)} USDC / debt ${formatEtherValue(nextLive.backstopDebt)} REACT`,
        "safe"
      );
    } catch (error) {
      pushFeed("Refresh Failed", friendlyError(error), "danger");
    } finally {
      setLoadingState(false);
    }
  }

  async function connectWallet() {
    try {
      await syncWalletState({ request: true, announce: true });
    } catch (error) {
      pushFeed("Wallet", friendlyError(error), "danger");
    }
  }

  async function switchSepolia() {
    try {
      if (!window.ethereum) {
        pushFeed("Network", "No browser wallet found.", "danger");
        return;
      }

      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      pushFeed("Network", "Wallet switched to Sepolia.", "safe");
    } catch (error) {
      pushFeed("Network", friendlyError(error), "danger");
    }
  }

  async function requireSepoliaSigner() {
    let provider = browserProvider;
    if (!provider) {
      const walletState = await syncWalletState({ request: true });
      if (!walletState?.provider) {
        throw new Error("No browser wallet found.");
      }
      provider = walletState.provider;
    }

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== CONFIG.networks.sepolia.chainId) {
      await switchSepolia();
    }

    return provider.getSigner();
  }

  async function runSepoliaAction(label, runner) {
    try {
      setLoadingAction(label);
      const signer = await requireSepoliaSigner();
      const contracts = {
        vault: new ethers.Contract(CONFIG.contracts.vault, vaultAbi, signer),
        adapter: new ethers.Contract(CONFIG.contracts.adapter, adapterAbi, signer),
      };

      pushFeed(label, "Transaction submitted to Sepolia.", "watch");
      const tx = await runner(contracts);
      pushFeed(label, `Pending ${shortHash(tx.hash)}`, "watch");
      await tx.wait();
      pushFeed(label, `Confirmed ${shortHash(tx.hash)}`, "safe");
      await loadState();
    } catch (error) {
      pushFeed(label, friendlyError(error), "danger");
    } finally {
      setLoadingAction(null);
    }
  }

  useEffect(() => {
    loadState();

    const intervalId = window.setInterval(() => {
      loadState({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [positionId]);

  useEffect(() => {
    if (!window.ethereum || bootedRef.current) return;
    bootedRef.current = true;

    syncWalletState({ request: false }).catch(() => {});

    const handleAccountsChanged = async (accounts) => {
      const nextWallet = accounts[0] ? ethers.getAddress(accounts[0]) : null;
      setWalletAddress(nextWallet);
      pushFeed("Wallet", nextWallet ? `Active account ${shortAddress(nextWallet)}` : "Wallet disconnected.", nextWallet ? "safe" : "watch");
      await loadState({ silent: true });
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      }
    };
  }, []);

  const rscDotColor =
    live && decision.tone === "danger"
      ? "#ffb347"
      : live
        ? "#00ffaa"
        : "#ffb347";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0b0f",
        color: "#fff",
        fontFamily: "'Outfit', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.85); }
        }

        @keyframes pulse-ring {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.8); }
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
        }

        .layout-two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .stat-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .link-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .tab-nav {
          display: flex;
          gap: 2px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
        }

        .tab-nav::-webkit-scrollbar {
          display: none;
        }

        .tab-button {
          flex-shrink: 0;
        }

        .field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .field-label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          color: rgba(255,255,255,0.36);
          font-family: 'JetBrains Mono', monospace;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .control-input,
        .value-pill {
          width: 100%;
          min-height: 44px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 12px 14px;
          color: #fff;
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          outline: none;
        }

        .value-pill {
          display: flex;
          align-items: center;
          color: rgba(255,255,255,0.78);
          word-break: break-word;
        }

        .button-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .note-block {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.56);
          font-size: 12px;
          line-height: 1.5;
          font-family: 'JetBrains Mono', monospace;
        }

        @media (max-width: 980px) {
          .link-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 860px) {
          .layout-two,
          .field-grid,
          .button-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .link-grid {
            grid-template-columns: 1fr;
          }

          .tab-nav {
            flex-wrap: wrap;
            overflow: visible;
          }

          .tab-button {
            flex: 1 1 calc(50% - 2px);
            justify-content: center;
          }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: `
            radial-gradient(ellipse 600px 400px at 20% 20%, rgba(108,92,231,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 500px 500px at 80% 80%, rgba(0,255,170,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 400px 300px at 60% 10%, rgba(255,179,71,0.03) 0%, transparent 70%)
          `,
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: 0.03,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px 56px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            padding: "24px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #6c5ce7, #00ffaa)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 800,
                color: "#0a0b0f",
                boxShadow: "0 0 20px rgba(108,92,231,0.3)",
              }}
            >
              B
            </div>
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                Backstop
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.35)",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Reactive Liquidation Shield
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <PulsingDot color={rscDotColor} size={7} />
              <span
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {loadingState ? "Refreshing" : "RSC Live"}
              </span>
            </div>
            <button
              onClick={connectWallet}
              style={{
                background: walletAddress
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg, #6c5ce7, #a29bfe)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                letterSpacing: "0.04em",
              }}
            >
              {walletAddress ? shortAddress(walletAddress) : "Connect Wallet"}
            </button>
          </div>
        </header>

        <nav
          className="tab-nav"
          style={{
            padding: "16px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {TABS.map((tabItem) => (
            <button
              key={tabItem.id}
              className="tab-button"
              onClick={() => setTab(tabItem.id)}
              style={{
                background: tab === tabItem.id ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none",
                color: tab === tabItem.id ? "#fff" : "rgba(255,255,255,0.35)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s ease",
                letterSpacing: "0.02em",
              }}
            >
              <span style={{ fontSize: 14 }}>{tabItem.icon}</span>
              {tabItem.label}
            </button>
          ))}
        </nav>

        <main style={{ padding: "28px 0 0" }}>
          {tab === "overview" ? (
            <OverviewTab
              live={live}
              feedEntries={feedEntries}
              decision={decision}
              contractLinks={contractLinks}
              onRefresh={() => loadState()}
            />
          ) : null}
          {tab === "reserve" ? (
            <ReserveTab
              live={live}
              ownerInput={ownerInput}
              setOwnerInput={setOwnerInput}
              walletAddress={walletAddress}
              connectWallet={connectWallet}
              switchSepolia={switchSepolia}
              useConnectedWallet={() => {
                if (walletAddress) {
                  setOwnerInput(walletAddress);
                }
              }}
              refreshState={() => loadState()}
              actionInputs={actionInputs}
              setActionInputs={setActionInputs}
              runReplayProtection={() =>
                runSepoliaAction("Replay Protection", async (contracts) =>
                  contracts.vault.configureProtection(
                    positionId,
                    parseHealthFactor(actionInputs.minHealthFactor),
                    parseToken(actionInputs.rescueAmount),
                    BigInt(actionInputs.cooldownBlocks || "0")
                  )
                )
              }
              runReplayReserve={() =>
                runSepoliaAction("Replay Reserve", async (contracts) =>
                  contracts.vault.depositReserve(positionId, 0n)
                )
              }
              runSyncPosition={() =>
                runSepoliaAction("Sync Position", async (contracts) =>
                  contracts.adapter.syncPosition(positionId)
                )
              }
              loadingAction={loadingAction}
            />
          ) : null}
          {tab === "policy" ? (
            <PolicyTab
              live={live}
              decision={decision}
              positionId={positionId}
              contractLinks={contractLinks}
            />
          ) : null}
          {tab === "history" ? (
            <HistoryTab proofRows={CONFIG.proofRows} feedEntries={feedEntries} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<BackstopDashboard />);
