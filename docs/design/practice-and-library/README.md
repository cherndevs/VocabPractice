# Practice and Library — design canvas snapshot (CHE-39)

A copy of the design canvas at https://claude.ai/artifact/Dc4fH7D3oxx6qj2ez8732B, taken 2026-10-02 (artifact version `1790913711-876a`).

**The live canvas is the source of truth.** This copy exists so the designs are versioned next to the decisions they draw (ADR-0009, ADR-0010, `CONTEXT.md`) and readable without access to the artifact. It goes stale whenever the canvas is edited; re-copy after changes. Where this copy, the canvas and the docs disagree, the docs win.

- `canvas.json` — the layout: one entry per screen, with its position and title.
- `*.dc.html` — one screen each. `Main` is the Practice screen; `SessionType` → `Created` is the creation flow, in step order.

The `.dc.html` files are Design Component pages. They render only inside the canvas editor, which supplies `support.js`, so open the canvas link to see them. The files are still readable as HTML.

The older canvas at https://claude.ai/code/artifact/5f7a5c56-4649-498e-b1b8-cde715a7cab8 is out of date and not copied here.
