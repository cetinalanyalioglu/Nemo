## General

- [ ] Testing

## Feature

- [x] Management of edge and node based data
- [x] Rendering edge and node based data

## Save / load

- [ ] Clear deferred file load when target model definition fails to fetch (pending payload can otherwise apply on a later manual model switch)
- [ ] Require `model.id` in save files and reject loads that omit it (today a missing id applies data against whatever model is currently active)
- [ ] After load, validate that every node/edge type in the file exists in the active model definition and surface a clear warning for unknown types
- [ ] Add explicit save-format migration or version-range docs if we ship format changes beyond 2.x

## Performance
Defer until needed:
- [ ] **Drag-end position sync** — let React Flow own positions while dragging; write to Zustand on drag end (best remaining win for large graphs)
- [ ] **Undo snapshot cost** — replace full JSON clone/compare in `recordHistory` with cheaper snapshots (helps drag-start hitches on big canvases)
- [ ] **`onlyRenderVisibleElements`** — try on React Flow when many nodes are off-screen
- [ ] **xyflow v12** — planned upgrade, not urgent for perf alone
- [ ] **Cleanup** — remove unused AppState viewport/zoom; trim debug logging in production

## Recent thoughts
- [ ] Ensure style is completely handled in CSS and placed outside functional code
- [x] Theme capability, e.g. dark/light
- [x] Edge lengths are too long in the automatically generated layout
- [x] Minimap should be optional
- [x] Global model parameters and their management from a pane
- [x] Console
- [ ] Add setting: force unique node labels or not
- [ ] Edge and node label areas below them, displaying certain information
- [x] Model pane: move model selector to the model pane, introduce global model level parameters
