---
name: verify
description: Build/launch/drive recipe for verifying Nemo canvas changes end-to-end in a real browser.
---

# Verifying Nemo changes

Vite + React + React Flow v11 app. No test harness for the canvas — verify by
driving the real app.

## Launch

```bash
npm run dev -- --port 5199 --strictPort   # background; ready in ~2s
```

Then drive `http://localhost:5199/` with Playwright (browser MCP tools work).

## Driving the canvas

- **Drop an element**: dispatch `dragover` + `drop` DragEvents on `.react-flow`
  with a `DataTransfer` carrying `application/reactflow` = element type
  (`Duct`, `MassFlowInlet`, `JunctionStaticP`, …; types live in
  `public/models/nefes.yaml`). Annotations use the
  `application/nemo-annotation` MIME.
- **Connect ports**: real mouse drag from one `[data-handleid="{nodeId}-port-{n}"]`
  center to another (mouse.down → move with steps → up).
- **Rotate an element**: Playwright's Alt+mouse-drag does NOT arm the rotate
  gesture; instead dispatch a synthetic `PointerEvent('pointerdown', {altKey:
  true, …})` on the node's `.custom-node`, then `pointermove` events on
  `window`, then `pointerup` (the handler listens on window).
- **Store access**: `await import('/src/store/graphStore.ts')` in the page gives
  the live zustand store (`useGraphStore.getState()`) — but ONLY on a fresh dev
  server. After any HMR update the app's module graph uses `?t=` timestamped
  URLs and the plain import returns a *different store instance* (symptom:
  actions log "node not found"). Restart the dev server + reload to re-sync.
- **Left rail panes**: `.nav-button` index 4 opens ANNOTATIONS (check
  `.panel-title` text after clicking).

## Driving the Python console

Fastest way to put a real network on the canvas:
`useGraphStore.getState().openCase(doc, 'label')` with a case document — the
same mapping `nefes.io.case_to_dict(net)` returns.

- Open it with `page.getByRole('tab', { name: 'Python' }).click()`, then wait for
  `.console-python-input` to be **visible**, not merely present. Both tabs stay
  mounted, so the prompt exists while the Messages tab is showing.
- Submit with `input.fill(line)` + `press('Enter')`, then wait for
  `.python-status` to carry `ready` or `failed`. The first submission also boots
  the interpreter — allow a few minutes on a cold network, ~5 s warm.
- The transcript is `.python-line`; the live prompt marker (`>>>` vs `...`) is
  `.console-python-prompt .python-line-prompt`.
- `nemo.replace(doc)` on a document carrying result sets opens the dataset
  chooser, which blocks later clicks. Dismiss `.dataset-load-overlay` first.

## Measuring edge/port alignment

Edge endpoint vs port: take each `.react-flow__edge-path`, map
`getPointAtLength(0 | total)` through `getScreenCTM()`, and compare with the
handle's `getBoundingClientRect()` center. Gap should be ~0px at any node
rotation.

## Gotchas

- Editing source while the page is open triggers HMR full reloads that wipe the
  canvas scene — rebuild the scene after every source edit.
- Screenshots land in `<repo>/.playwright-mcp/` — delete it when done (not
  gitignored).
