#!/usr/bin/env node

import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import https from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = "lukasmetzler/agenteval";
const binDir = join(__dirname, "bin");
const binPath = join(binDir, "agenteval");

function detectBinary() {
	const platform = process.platform === "darwin" ? "darwin" : "linux";
	const arch = process.arch === "arm64" ? "arm64" : "x64";

	if (platform === "linux" && arch !== "x64") {
		throw new Error(`Unsupported platform: ${platform}-${arch}`);
	}

	return `agenteval-${platform}-${arch}`;
}

function download(url, dest) {
	return new Promise((resolve, reject) => {
		https
			.get(url, { headers: { "User-Agent": "agenteval-npm" } }, (res) => {
				if (res.statusCode === 301 || res.statusCode === 302) {
					return download(res.headers.location, dest).then(resolve, reject);
				}
				if (res.statusCode !== 200) {
					reject(new Error(`Download failed: HTTP ${res.statusCode}`));
					return;
				}
				const file = createWriteStream(dest);
				res.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
				file.on("error", reject);
			})
			.on("error", reject);
	});
}

async function main() {
	const binary = detectBinary();

	// Read version from package.json
	const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
	const version = `v${pkg.version}`;
	const url = `https://github.com/${REPO}/releases/download/${version}/${binary}`;

	if (!existsSync(binDir)) {
		mkdirSync(binDir, { recursive: true });
	}

	console.log(`Downloading agenteval ${version} (${binary})...`);
	await download(url, binPath);
	chmodSync(binPath, 0o755);
	console.log("agenteval installed successfully.");
}

main().catch((err) => {
	console.error(`Failed to install agenteval: ${err.message}`);
	console.error("Install manually: https://github.com/lukasmetzler/agenteval/releases");
	process.exit(1);
});
