# Custom node type without props

Demonstrates a runtime `Meter` node type. Custom fields (`value`, `max`, `barWidth`, `barHeight`, `fill`) live directly on the node — there is no `props` wrapper.

`assign` is shared by `build()` and `apply()`, so every document-driven field should be written there.
