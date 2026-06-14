## General
- [ ] In data pane, under datasets container, the data names should be selectable to switch edge or node data display to selected variable
- [ ] After loading data, let the canvas go automatically to the "freeze" mode. A warning should display if user "unfreezes" it. This is because a modified canvas renders to data incompatible with the canvas
- [ ] Ability to store case and data together
- [ ] Register edge area as edge data too (for visualization capability)
- [ ] Introduce a case title concept
- [ ] Add a tool to check network validity. At basic we don't allow disconnected elements and non-connected ports.

## Wild ideas
- [ ] Plot quantity "along" selected elements. Something like, user selects two nodes/edges whatever, we find possible paths between these two, and for each path plot the selected quality at y axis with x axis the position on path.
- [ ] Associate data items with loaded "dataset" + edge/node index of that dataset. This would open up possibility to open multiple case/data combos to compare cases. This would also become important when we, in the future, append another network into the canvas. Two or more of them would co-exist, but their numbering would be internal to them.
