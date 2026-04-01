# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-04-01

### Added

- Project scaffold with CLI skeleton (`agenteval --version`, `--help`)
- Stub commands for `lint`, `run`, `results`, `compare`, `harvest`
- CI pipeline (GitHub Actions): lint, typecheck, test, build binary
- Release pipeline: tagged releases with pre-built binaries
- Biome configuration (recommended + strict cherry-picks)
- TypeScript strict mode
