---
name: deploy-to-production
description: I deploy the application to production via GitHub Actions
---

## Steps

1. Run the test suite: `bun test`
2. Build the production bundle: `bun run build`
3. Push to main branch
4. Wait for CI to pass
5. Trigger the deploy workflow
6. Verify health check endpoint responds

## Rollback

If the deploy fails, revert the last commit and redeploy:
```bash
git revert HEAD
git push origin main
```
