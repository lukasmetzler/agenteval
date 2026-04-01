# TODOS

## agenteval ci — continuous instruction quality regression detection
**What:** A command (`agenteval ci`) that runs harvested eval tasks on every PR and fails the build if the overall score regresses below a threshold.
**Why:** Harvest creates the benchmark dataset. CI runs it continuously. Together they close the feedback loop automatically — change your CLAUDE.md, CI tells you if it got better or worse.
**Pros:** Catches instruction quality regressions before merge. Integrates with GitHub Actions / CI pipelines.
**Cons:** Requires harvested tasks to exist first. Needs threshold tuning to avoid false positives on noisy tasks.
**Context:** Suggested by outside voice during Phase 3.0 eng review. Depends on harvest (Phase 3.0) being shipped first. Natural Phase 3.2 or 4 feature.
**Depends on:** Phase 3.0 (harvest) and Phase 2 (run engine).
