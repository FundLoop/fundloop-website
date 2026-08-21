# Agent Context

This directory is the lightweight, live context surface for FundLoop agents.

Keep this folder small and current. It should hold the working context agents need during active implementation, not the full set of long-lived engineering docs.

## Live Agent Context

- [FundLoop Project 1](https://github.com/orgs/FundLoop/projects/1)
  Active roadmap/backlog surface for new work. Prefer GitHub Issues in this Project over repo-local todo files.
- [Superseded MCP TODO Roadmap](./todo-mcp.md)
  Historical MCP-focused execution backlog, superseded by Project 1 and [Feature #43](https://github.com/FundLoop/fundloop-website/issues/43).
- [Archived Sessions 1-52 Roadmap](./todo-1-through-52.md)
  Completed app/product roadmap archived after Session 52 and superseded by Project 1.
- [Session Logs](./session-log/)
  Branch-scoped records of completed work, validation, and next steps.
- [Repo Status](./repo-status.md)
  Current cleanup and hygiene snapshot for short-lived agent orientation.

## Long-Lived Engineering Docs

- [Engineering Docs Index](../docs/engineering/README.md)
- [Backgrounder for Agents](../docs/engineering/backgrounder-for-agents.md)
- [Current-State Architecture](../docs/engineering/current-state-architecture.md)
- [Target-State Architecture](../docs/engineering/target-state-architecture.md)
- [Information Architecture](../docs/engineering/information-architecture.md)
- [Route Inventory](../docs/engineering/route-inventory.md)

## How To Use This Folder

1. Start with the engineering backgrounder for product intent.
2. Read current-state and target-state in `docs/engineering/` before choosing implementation work.
3. Use GitHub Issues in Project 1 to pick the next scoped session.
4. Update the branch-scoped session log with completed work.
5. Update `docs/engineering/` when architecture, routes, workflows, or operating assumptions changed.
