import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.BACKSTOP_UI_PORT || 4173);
const root = join(process.cwd(), "src", "demos", "backstop", "ui");

const rpcTargets = {
  "/rpc/sepolia":
    process.env.BACKSTOP_UI_SEPOLIA_RPC || "https://ethereum-sepolia-rpc.publicnode.com",
  "/rpc/lasna":
    process.env.BACKSTOP_UI_LASNA_RPC || "https://lasna-rpc.rnk.dev/",
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname in rpcTargets) {
      await proxyRpc(req, res, rpcTargets[requestUrl.pathname]);
      return;
    }

    const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = join(root, normalize(pathname));

    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const file = await readFile(filePath);
    const contentType = contentTypes[extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "content-type": contentType }).end(file);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(error?.message || "Not found");
  }
}).listen(port, () => {
  console.log(`Backstop UI available at http://localhost:${port}`);
});

async function proxyRpc(req, res, target) {
  const body = await readBody(req);
  const upstream = await fetch(target, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
  });

  const payload = await upstream.text();
  res.writeHead(upstream.status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
