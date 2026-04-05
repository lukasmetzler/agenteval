#!/usr/bin/env node

const { execFileSync, execSync } = require("child_process");
const { existsSync, mkdirSync, chmodSync, renameSync, unlinkSync } = require("fs");
const { join } = require("path");
const https = require("https");

const REPO = "lukasmetzler/agenteval";
const CACHE_DIR = join(require("os").homedir(), ".agenteval", "bin");
const BIN_PATH = join(CACHE_DIR, "agenteval");
const VERSION_PATH = join(CACHE_DIR, ".version");

function getPlatformKey() {
	const platform = process.platform;
	const arch = process.arch;
	if (platform === "darwin" && arch === "arm64") return "agenteval-darwin-arm64";
	if (platform === "darwin" && arch === "x64") return "agenteval-darwin-x64";
	if (platform === "linux" && arch === "x64") return "agenteval-linux-x64";
	return null;
}

function getPackageVersion() {
	try {
		return require("../package.json").version;
	} catch {
		return null;
	}
}

function getCachedVersion() {
	try {
		return require("fs").readFileSync(VERSION_PATH, "utf8").trim();
	} catch {
		return null;
	}
}

function download(url) {
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			if (res.statusCode === 301 || res.statusCode === 302) {
				return download(res.headers.location).then(resolve, reject);
			}
			if (res.statusCode !== 200) {
				reject(new Error(`HTTP ${res.statusCode}`));
				return;
			}
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

	// Binary exists and matches current package version
	if (existsSync(BIN_PATH) && cachedVersion === pkgVersion) {
		return BIN_PATH;
	}

	const binary = getPlatformKey();
	if (!binary) {
		console.error(`agenteval: unsupported platform ${process.platform}-${process.arch}`);
		console.error("Supported: linux-x64, darwin-arm64, darwin-x64");
		console.error("Install manually: https://github.com/lukasmetzler/agenteval/releases");
		process.exit(1);
	}

	const version = pkgVersion ? `v${pkgVersion}` : "latest";
	const url = `https://github.com/${REPO}/releases/download/${version}/${binary}`;

	console.error(`Downloading agenteval ${version} (${binary})...`);

	mkdirSync(CACHE_DIR, { recursive: true });

	const tmpPath = `${BIN_PATH}.tmp.${Date.now()}`;
	try {
		const data = await download(url);
		require("fs").writeFileSync(tmpPath, data);
		chmodSync(tmpPath, 0o755);

		// Atomic replace
		if (existsSync(BIN_PATH)) {
			try { unlinkSync(BIN_PATH); } catch {}
		}
		renameSync(tmpPath, BIN_PATH);
		require("fs").writeFileSync(VERSION_PATH, pkgVersion || version);

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
		const result = execFileSync(binPath, process.argv.slice(2), { stdio: "inherit" });
	} catch (err) {
		process.exit(err && typeof err === "object" && "status" in err ? err.status : 1);
	}
}).catch((err) => {
	console.error(`agenteval: ${err.message}`);
	process.exit(1);
});
