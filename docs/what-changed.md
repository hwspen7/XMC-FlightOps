# System grid cascade correction

The prior `system-topology.css` change was superseded by a higher-specificity
compact layout rule in `operations-density.css`:

```
.xmc-ops-compact .xmc-systems-grid { display: block; column-count: 3 }
```

With CSS multicolumn layout, items are independently packed and row edges
cannot align. The new scoped override installs a **real two-row, three-column
CSS grid** and explicit positions for the six existing system cards.

Desktop (at least 1200 CSS pixels):

Electrical | Autopilot | Anti-ice
Hydraulic  | Cabin     | Landing

All three cards in each grid row share the same top and bottom boundaries.
At widths below 1200 pixels there are two columns. Below 760 pixels there is
one column.

No data, control, component, or other operations layout is changed.
