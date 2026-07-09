# TODO's

## Issues

## General
- [ ] Add the UI counterpart of the Nefes `linear_resistance` element (LinearResistance): a 2-port linear flow resistance with one parameter `R` (Pa per kg/s), `Pt_in - Pt_out = R * mdot`. Model resistance in quiescent/low-Mach cases where the quadratic loss vanishes. Needs an icon, a node type, the param form, and the nefes YAML <-> Nefes mapping (yaml_in/yaml_out).
- [ ] Edge thickness as a visualization aid

## Wild ideas
- [ ] Plot quantity "along" selected elements. Something like, user selects two nodes/edges whatever, we find possible paths between these two, and for each path plot the selected quality at y axis with x axis the position on path.
- [ ] Icon and element display overhaul

## To brainstorm
- [ ] A way to compare loaded datasets
