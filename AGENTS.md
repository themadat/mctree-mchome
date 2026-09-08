# McFamily agent instructions

McFamily is a dependency-free static HTML/CSS/JavaScript family atlas. `context/LLM_HANDOFF.md` is the short, durable implementation contract.

## Start

1. Run `git status --short`; preserve all existing/manual work.
2. Read `context/LLM_HANDOFF.md`.
3. Read `context/WISHES.md` only for `wish`, `plan`, `start`, or `cut` work.
4. For active planned work, inspect the plan's `## Resume`, `git log --oneline -5`, and `git diff main...HEAD --stat`.

## Agent continuity protocol

Agent work must be resumable across sessions.

### `continue`

When the user sends only `continue`, resume the current task:

1. Read `AGENT_STATUS.md`.
2. Inspect `git status`, the current diff, recent relevant commits, and relevant changed files.
3. Verify `AGENT_STATUS.md` against the actual repository state.
4. Determine whether the current phase is `PLANNING`, `IMPLEMENTING`, `TESTING`, `VERIFYING`, `COMPLETE`, or `BLOCKED`.
5. Continue with the next unfinished work.
6. Do not redo completed work unless repository inspection or verification shows it is necessary.
7. Keep `AGENT_STATUS.md` updated as work progresses.

If `AGENT_STATUS.md` does not exist, infer the current state from the repository, current task context, git history, and working tree, then create it.

### Persistent status

Maintain `AGENT_STATUS.md` in the repository root for any active unfinished agent task. Keep it concise and use this structure:

```markdown
# Goal
Current task.
# Status
PLANNING | IMPLEMENTING | TESTING | VERIFYING | COMPLETE | BLOCKED
# Checkpoint
Current agent checkpoint version and commit, if one exists.
# Completed
- Completed work
# Remaining
- Remaining work
# Verification
- Build: PASS | FAIL | NOT RUN
- Tests: PASS | FAIL | NOT RUN
- Lint: PASS | FAIL | NOT RUN
- Review: PASS | FAIL | NOT RUN
# Next
Exact next action.
# Decisions
- Important implementation decisions or assumptions
```

Update the file after meaningful milestones and before stopping whenever possible. Do not use it as a verbose work log; it describes the current resumable state.

### Agent checkpoints

A `+X` build suffix represents an agent checkpoint, not a release and not specifically a usage-limit event, for example `1.4.0`, `1.4.0+1`, `1.4.0+2`, and `1.4.0+3`.

For long-running tasks, create checkpoints at useful stable boundaries so another agent can resume without losing significant work. Good boundaries include:

- a meaningful implementation unit is complete;
- implementation is complete and testing is beginning;
- testing is complete and verification is beginning;
- substantial progress has been made before another large unit of work;
- available agent usage or context appears to be getting low;
- the agent otherwise expects the session may stop soon.

Do not depend on being able to predict exactly when usage or context will run out.

When creating an agent checkpoint:

1. Reach a coherent stopping point.
2. Update `AGENT_STATUS.md`.
3. Find the project's existing canonical version source.
4. Preserve the normal version and increment only build metadata, such as `1.4.0` to `1.4.0+1`, then `1.4.0+2`. Do not invent a second versioning system. If the project's version format cannot support `+X`, preserve its conventions and record the checkpoint number only in `AGENT_STATUS.md`.
5. Run reasonable validation for the state being checkpointed.
6. Update `# Checkpoint` in `AGENT_STATUS.md`.
7. When repository commit policy permits a checkpoint commit, use `checkpoint: <version> - <short description>`. After committing, record the checkpoint version and commit hash, such as `1.4.0+2 (a1b2c3d)`.

McFamily's canonical application version is in `assets/js/config.js` and uses the required four-part `major.minor.patch.build` release format mirrored across the release, HTML, service-worker, workflow, and documentation surfaces. That format does not support `+X`. Do not change the McFamily application version for an agent checkpoint; record checkpoint numbers only in `AGENT_STATUS.md`. The repository's existing rule not to commit without explicit user instruction also applies to checkpoint commits.

Do not automatically create a checkpoint commit if:

- unrelated user changes would be included;
- secrets or generated files that should not be committed are present;
- the repository is knowingly too broken to provide a useful resume state;
- the user has instructed you not to commit;
- the repository's project-specific instructions require explicit authorization that has not been given.

Never discard, reset, overwrite, or clean unrelated user changes to create a checkpoint.

### Usage and context awareness

During long-running work, periodically check remaining usage, context, or session limits when the environment exposes them. If remaining capacity appears low:

1. Stop starting new large implementation units.
2. Finish the smallest coherent unit currently in progress.
3. Run the most relevant available verification.
4. Update `AGENT_STATUS.md`.
5. Create an agent checkpoint if it is safe and permitted.
6. Leave `# Next` with a precise instruction for the next agent.

If remaining usage cannot be determined, rely on regular milestone checkpoints.

### Completion standard

Do not mark a task `COMPLETE` merely because coding is finished. `COMPLETE` means:

- requested functionality is implemented;
- relevant tests pass;
- build or typecheck passes where applicable;
- lint passes where applicable;
- implementation has been reviewed against the original request;
- no known required work remains.

The expected progression is `IMPLEMENTING` to `TESTING` to `VERIFYING` to `COMPLETE`. If implementation is finished but testing has not been completed, use `TESTING`. If tests pass but the task still needs final review against the request, use `VERIFYING`.

When the task is truly complete, set `AGENT_STATUS.md` to `COMPLETE`, clearly record final verification results, and do not create another `+X` checkpoint solely because the task completed unless the repository's normal release/versioning process requires it.

### Initial setup

After adding this protocol:

1. Inspect the repository's current versioning mechanism.
2. Do not change the current application version merely to install this protocol.
3. Create `AGENT_STATUS.md` only if there is currently an active unfinished task; otherwise wait until agent work begins.
4. Briefly report where the canonical version is stored, whether `+X` build metadata is supported, and whether existing `AGENTS.md` instructions were preserved or merged.

## Work

- Search with `rg`; keep changes narrow and do not reformat unrelated code.
- Keep runtime static, dependency-free, accessible, offline-capable, and safe on an ordinary static host.
- Central identity, versions, limits, access modes, and relationship vocabularies live in `assets/js/config.js`.
- The current five-file McFamily ZIP contract is exact and latest-only. Never add demo/blank first-run bypasses or commit real family data.
- Relationships are authoritative. Reject missing references, self-links, duplicates, and ancestry cycles; derive relatives and lineage.
- Use semantic HTML, labels, visible focus, escaped text, safe URLs, touch targets, reduced motion, and the shared inline SVG catalog.
- Application versions are `major.minor.patch.build`. Every completed app update increments build; a requested major/minor/patch change resets build to `1`. Keep config, release entry, HTML queries, service-worker ids, and the version in `.github/workflows/deploy-pages.yml`'s workflow `name` identical.

## Lifecycle shorthand

- `wish`: record an idea in `context/WISHES.md`; do not plan or build it.
- `plan`: investigate and write `context/WISH-###-slug-PLAN.md`; do not build it.
- `start`: implement an approved plan and maintain its Resume section.
- `cut`: finish the active release, update version/release/cache surfaces, close the wish, and run the release gate.

Do not silently advance lifecycle stages.

## Verify

Run `node scripts/verify.mjs` (or the bundled Node path) after every code change. Add only the targeted browser/print/offline checks listed in `docs/TESTING.md`; run its full release gate for `cut`.

## Finish

After changing files, report the outcome and verification. Give exactly one copy-paste command that stages only request files, commits with subject `Version - Text`, and pushes the current branch. Use `git add .` only when every status entry belongs to the request. Do not commit or push unless explicitly asked.
