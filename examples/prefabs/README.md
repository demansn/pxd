# Prefabs

Demonstrates a Library document with a reusable `Card` subtree.

Each prefab instance receives its own id scope, so `leftCard.badge` and `rightCard.badge` are distinct live objects even though the prefab body uses the same internal ids.
