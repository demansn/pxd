# Hot reload with apply

Demonstrates patch semantics:

- `apply()` mutates existing matched nodes in place.
- Present fields update live state.
- Omitted live children remain attached.
- Missing document children call `onMissing` and are skipped.
