#!/usr/bin/env node

const { execFileSync } = require("child_process");
const { createHash } = require("crypto");
const { existsSync, mkdirSync, chmodSync, renameSync, unlinkSync, readFileSync, writeFileSync } = require("fs");
const { join } = require("path");
const https = require("https");

const REPO = "lukasmetzler/agenteval";
const CACHE_DIR = join(require("os").homedir(), ".agenteval", "bin");
const BIN_PATH = join(CACHE_DIR, "agenteval");
const VERSION_PATH = join(CACHE_DIR, ".version");

// SHA256 checksums injected by the release workflow.
// If all zeros, integrity check is skipped (dev/unreleased builds).
const CHECKSUMS = {
	"agenteval-linux-x64": "0000000000000000000000000000000000000000000000000000000000000000",
	"agenteval-darwin-arm64": "0000000000000000000000000000000000000000000000000000000000000000",
	"agenteval-darwin-x64": "0000000000000000000000000000000000000000000000000000000000000000",
};

function getPlatformKey() {
	if (process.platform === "darwin" && process.arch === "arm64") return "agenteval-darwin-arm64";
	if (process.platform === "darwin" && process.arch === "x64") return "agenteval-darwin-x64";
	if (process.platform === "linux" && process.arch === "x64") return "agenteval-linux-x64";
	return null;
}

function getPackageVersion() {
	try { return require("../package.json").version; } catch { return null; }
}

function getCachedVersion() {
	try { return readFileSync(VERSION_PATH, "utf8").trim(); } catch { return null; }
}

function verifySHA256(data, expected) {
	// Skip verification if checksums are placeholder zeros
	if (expected.startsWith("0000000000")) return true;
	const actual = createHash("sha256").update(data).digest("hex");
	return actual === expected;
}

function download(url, maxRedirects) {
	if (maxRedirects === undefined) maxRedirects = 5;
	if (maxRedirects <= 0) return Promise.reject(new Error("Too many redirects"));
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const options = { hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search, headers: { "User-Agent": "agenteval-cli" } };
		https.get(options, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				const location = res.headers.location;
				const ALLOWED_HOSTS = ["github.com", "objects.githubusercontent.com"];
				try {
					const redirectUrl = new URL(location || "");
					if (redirectUrl.protocol !== "https:" || !ALLOWED_HOSTS.some(h => redirectUrl.hostname.endsWith(h))) {
						reject(new Error(`Unsafe redirect to ${location}`));
						return;
					}
				} catch {
					reject(new Error(`Invalid redirect URL: ${location}`));
					return;
				}
				return download(location, maxRedirects - 1).then(resolve, reject);
			}
			if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
			const chunks = [];
			res.on("data", (chunk) => chunks.push(chunk));
			res.on("end", () => resolve(Buffer.concat(chunks)));
			res.on("error", reject);
		}).on("error", reject);
	});
}

async function ensureBinary() {
	const pkgVersion = getPackageVersion();
	const cachedVersion = getCachedVersion();

	if (existsSync(BIN_PATH) && cachedVersion === pkgVersion) {
		return BIN_PATH;
	}

	const binary = getPlatformKey();
	if (!binary) {
		console.error(`agenteval: unsupported platform ${process.platform}-${process.arch}`);
		console.error("Supported: linux-x64, darwin-arm64, darwin-x64");
		process.exit(1);
	}

	const version = pkgVersion ? `v${pkgVersion}` : "latest";
	const url = `https://github.com/${REPO}/releases/download/${version}/${binary}`;

	console.error(`Downloading agenteval ${version} (${binary})...`);
	mkdirSync(CACHE_DIR, { recursive: true });

	const tmpPath = `${BIN_PATH}.tmp.${Date.now()}`;
	try {
		const data = await download(url);

		// Verify integrity
		const expectedHash = CHECKSUMS[binary];
		if (!verifySHA256(data, expectedHash)) {
			throw new Error("SHA256 checksum mismatch — download may be corrupted or tampered with");
		}

		writeFileSync(tmpPath, data);
		chmodSync(tmpPath, 0o755);
		if (existsSync(BIN_PATH)) { try { unlinkSync(BIN_PATH); } catch {} }
		renameSync(tmpPath, BIN_PATH);
		writeFileSync(VERSION_PATH, pkgVersion || version);
		console.error("Done.");
	} catch (err) {
		try { unlinkSync(tmpPath); } catch {}
		console.error(`agenteval: download failed (${err.message})`);
		console.error(`Install manually: https://github.com/${REPO}/releases`);
		process.exit(1);
	}

	return BIN_PATH;
}

ensureBinary().then((binPath) => {
	try {
		execFileSync(binPath, process.argv.slice(2), { stdio: "inherit" });
	} catch (err) {
		process.exit(err && typeof err === "object" && "status" in err ? err.status : 1);
	}
}).catch((err) => {
	console.error(`agenteval: ${err.message}`);
	process.exit(1);
});
