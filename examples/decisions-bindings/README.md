# Decisions and bindings

Demonstrates two load-time resolution features:

- Decision maps choose scalar values from `activeTags`.
- String bindings replace `{path}` through `resolve.binding`.

The example also shows that top-level custom scalar fields participate in decision/binding resolution before a custom `NodeType.assign` sees them.
