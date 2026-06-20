## Issues
- [x] After "Load", the canvas view is sometimes positioned abruptly. An automatic "fit view" would be appropriate.
- [x] When canvas is in a locked state, user can still perform actions which modify the canvas, such as adding new nodes, and adding/removing ports on supported elements through the properties pane. When canvas is locked, any topological change that would render the current numbering invalid should not be allowed.

## General
- [x] Contour plot "scale to visible" option
- [x] Some indicator hinting there is unread stuff printed in the console when a new message is printed there

## Wild ideas
- [ ] Plot quantity "along" selected elements. Something like, user selects two nodes/edges whatever, we find possible paths between these two, and for each path plot the selected quality at y axis with x axis the position on path.
- [ ] Associate data items with loaded "dataset" + edge/node index of that dataset. This would open up possibility to open multiple case/data combos to compare cases. This would also become important when we, in the future, append another network into the canvas. Two or more of them would co-exist, but their numbering would be internal to them.
- [ ] Calculator functionality to manipulate existing fields to generate new ones, preferably through a python backend.
