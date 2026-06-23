## Issues

- [ ] The parameter section names displayed in panes should be arranged alphabetically by default, and we need to provide a toggle to assign them a "precedence" value in YAML configs. This precedence would override on a category basis the alphabetic default.

- [ ] The "Datasets" section in the Data pane does not behave properly, especially the "cards" corresponding to different data sets. The collapse/uncollapse behaviour is weird, sometimes things overlap. Scrolling within the dataset card doesn't work properly, we only get to see the topmost 2-3 items.

- [ ] The min/max evaluation in "Node Data" and "Edge Data" panes should consider min/max of nodal and edge data in their own context - "Scale to visible" button should similarly distinguish between nodes or edges as well.

## General

## Wild ideas
- [ ] Plot quantity "along" selected elements. Something like, user selects two nodes/edges whatever, we find possible paths between these two, and for each path plot the selected quality at y axis with x axis the position on path.
- [ ] Associate data items with loaded "dataset" + edge/node index of that dataset. This would open up possibility to open multiple case/data combos to compare cases. This would also become important when we, in the future, append another network into the canvas. Two or more of them would co-exist, but their numbering would be internal to them.
- [ ] Icon and element display overhaul
