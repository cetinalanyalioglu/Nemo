---
name: verify
description: Build/launch/drive recipe for verifying FNetLibUI canvas changes end-to-end in a real browser.
---

# Verifying FNetLibUI changes

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
  `public/models/fns-flow-network.yaml`). Annotations use the
  `application/fnetlibui-annotation` MIME.
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
