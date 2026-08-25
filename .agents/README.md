# Local `.agents` Notes

This repository already uses project-local agent skills under:

`.agents\skills`

## Current State

- The installed project-local skills are tracked in `skills-lock.json`.
- The current local skill set was installed from `Leonxlnx/taste-skill`.
- Each skill lives in its own folder and is exposed through a `SKILL.md` file.

## How `mattpocock/skills` Maps Here

The `mattpocock/skills` repository uses two layers:

- `.agents/` for repo-level agent guidance and workflow docs
- `skills/` for the skill folders themselves

For this repository, the practical project-local mapping is:

- keep repo guidance docs under this `.agents/` folder
- place any imported skill folders under `.agents/skills/<skill-name>/`

Do not copy category folders like `engineering/` directly into `.agents/skills/`.
Instead, copy the individual skill directory so that the final shape stays:

```text
.agents/
  README.md
  skills/
    tdd/
      SKILL.md
    diagnosing-bugs/
      SKILL.md
```

## Recommended Import Strategy

If we adopt skills from `mattpocock/skills`, prefer a selective import instead of the entire repo.
This avoids duplicate or overlapping guidance with existing Codex/system skills and the current taste-skill set.

Good first candidates:

- `setup-matt-pocock-skills`
- `grill-with-docs`
- `triage`
- `to-spec`
- `to-tickets`
- `implement`
- `wayfinder`

Skills like `tdd`, `diagnosing-bugs`, and `code-review` are useful too, but they overlap with skills already available in this environment, so we should choose intentionally before installing them project-locally.
