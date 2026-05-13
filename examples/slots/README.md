# Slots

Demonstrates `slot` nodes as stable mount points for host-owned content.

Slot lookup uses `Symbol.for("pxd.slot")`, not labels, so `getSlot()` and `mountSlot()` keep working even when labels are used for path matching elsewhere.
