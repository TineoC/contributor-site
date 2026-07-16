# Agent guidance

## Git commits and EasyCLA

This repository is covered by the Linux Foundation **EasyCLA** check. Every identity listed on a commit must have a signed CLA.

Do **not** add a `Co-authored-by:` trailer for AI tools (including Cursor / `cursoragent@cursor.com`). EasyCLA treats co-authors as contributors; unsigned AI attributions fail the check and block the PR.

- Prefer no AI trailer, or use a non-CLA trailer such as `Assisted-by: Cursor` if disclosure is needed.
- Before committing from Cursor, disable **Cursor Settings → Agents → Attribution** so commits are not auto-tagged with `Co-authored-by: Cursor <cursoragent@cursor.com>`.
- If a commit already has that trailer, amend the message to remove it and force-push the feature branch (`git push --force-with-lease`) before expecting EasyCLA to pass.

Author and committer should be the human contributor who signed the CLA (for example `Christopher Tineo <christophertineo02@gmail.com>` / GitHub `TineoC`).
