---
name: mongo-backend-recovery
description: 'Fix Node.js backend startup failures caused by MongoDB Atlas connection issues, especially ECONNREFUSED/querySrv DNS failures and port conflicts on localhost. Use when npm start loops on Mongo retries or keeps changing ports.'
argument-hint: 'Backend path and preferred Mongo strategy (Atlas SRV, direct URI, or local Mongo)'
user-invocable: true
---

# Mongo Backend Recovery

## What This Skill Produces
A running backend that:
- starts on an available port,
- connects to MongoDB successfully,
- and avoids endless retry loops from misconfigured DNS or URI settings.

## When To Use
- Backend logs show `MongoDB connection failed (ECONNREFUSED)` repeatedly.
- Atlas SRV URI (`mongodb+srv://...`) fails on one machine but works elsewhere.
- Startup keeps auto-incrementing ports (`5000`, `5001`, ...).

## Workflow
1. Reproduce and capture symptoms.
- Run backend startup command (`npm start` or package-specific equivalent).
- Record port behavior and Mongo error text.

2. Check for local port conflicts.
- List listeners around expected ports (for example `5000-5010`).
- Identify stale `node` processes and stop only the conflicting ones.

3. Validate Mongo URI inputs.
- Confirm `.env` exists and `MONGO_URI` is present.
- If using Atlas SRV URI, test SRV DNS resolution with local DNS first.

4. Branch on DNS result.
- If local DNS resolves SRV: keep SRV URI and investigate credentials/network allowlist.
- If local DNS fails but public DNS resolves SRV: local DNS is the blocker.

5. Apply resilient connection strategy.
- Add `MONGO_URI_DIRECT` using Atlas host list + replica set options.
- Update backend connection code to fallback from `MONGO_URI` to `MONGO_URI_DIRECT` when SRV lookup fails (`querySrv`, `ENOTFOUND`, `ECONNREFUSED`).
- Keep retry loop, but include error message in logs for diagnostics.

6. Validate fix.
- Restart backend and confirm:
  - one stable startup port,
  - successful Mongo connection,
  - no repeating retry loop.

## Decision Points
- Use direct URI fallback when SRV DNS is machine-specific and public DNS works.
- Use local Mongo only if Atlas access is intentionally unavailable.
- Keep server startup independent from immediate DB availability only if app routes handle transient DB unavailability safely.

## Completion Checks
- Backend log includes `Server running on port ...`.
- Backend log includes `MongoDB connected`.
- No repeated `Retrying in 10s...` messages after stabilization.
- API calls that require DB return normal responses.

## Typical Edits
- Environment file: add `MONGO_URI_DIRECT`.
- Startup file (often `server.js`): add URI fallback + clearer error logs.
- Optional: add a small runbook note in repository memory/docs.
