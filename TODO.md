# TODO: упростить и усилить `pxd` как лёгкую Pixi.js-базу

Цель: маленькая независимая Pixi.js-библиотека для декларативных деревьев, которую можно использовать в любом Pixi.js-движке — от минимального runtime (`validate/build/apply/find/slots`) до расширенного слоя с custom node types, prefabs, CLI, schema и будущим reconcile.

## Принципы

- [ ] Держать публичный API маленьким: `validate`, `build`, `apply`, `find/findAll/requirePath`, `getSlot/mountSlot`.
- [ ] Всё продвинутое включать через options, а не через усложнение базового сценария.
- [ ] Главный механизм расширения — `nodeTypes`, не extensions.
- [ ] Intrinsic types — строгие и хорошо описанные; custom types — свободные и responsibility пользователя.
- [x] `apply()` по умолчанию и пока фактически только **patch-only**: отсутствующие поля не сбрасываются.
- [x] `mode: "full"` / reconcile оставить как будущий дизайн, не реализовывать частично.
- [ ] Не вводить type packs / custom schemas для сторонних типов, пока нет сильной необходимости.

## Характеристики кода и архитектуры:

- Кажду функцию держать отдельно (то-есть нельзя обьявлять функцию внутри другой функции) — для лучшей читаемости, тестируемости и возможности tree-shaking.
- разширяемость кода.
- Писать код так, чтобы его было легко читать и понимать, даже если он не самый оптимальный.
- Писать код так, чтобы его было легко тестировать и отлаживать.
- Писать код так, чтобы его было легко поддерживать и расширять в будущем.
- Изменчивость кода: быть готовым к изменениям в будущем, не бояться рефакторинга и улучшений.
- Гибкость кода: быть готовым к изменениям в требованиях и сценариях использования, не бояться экспериментировать и пробовать новые идеи.
- Низкая когнитивная нагрузка: писать код так, чтобы он был понятен и прост для других разработчиков, не требовал глубокого понимания внутренностей библиотеки.
- Размер интерфейсов и обьектов должны быть не слишком большие и не слишком маленькие, чтобы обеспечить достаточную функциональность и удобство использования, но не перегружать пользователя лишними деталями.
- Скрывать сложность и детали реализации от пользователя, предоставляя простой и понятный API, который позволяет ему сосредоточиться на своей задаче, а не на том, как работает библиотека внутри.

## 1. Упрощение custom node model

- [x] Удалить `props` из public модели жёстко — библиотека ещё ранняя (`0.x`).
- [x] Обновить `types.ts`: убрать `props` из `CustomNode`.
- [x] Обновить `validate.ts`: больше не требовать/разрешать special-case `props` для custom/prefab/runtime nodes.
- [x] Обновить `pxd.schema.json`: custom nodes принимают дополнительные top-level поля, но без `props` как особого контейнера.
- [x] Обновить `doc/pxd-v1.md`, README и guides: custom параметры лежат прямо на node.
- [x] Добавить migration note: было `{ props: { text } }`, стало `{ text }`.
- [x] Убрать `props` из `NON_DECIDABLE_KEYS` — custom top-level поля должны автоматически проходить decision resolution.
- [x] Добавить тест: custom scalar field с decision map приходит в `NodeType.assign()` уже resolved.

## 2. Custom nodes как composable containers

- [x] Разрешить `children` у custom/runtime node types.
- [x] В build: custom node строится обычным pipeline, затем его `children` добавляются в созданный `Container`.
- [x] В apply: custom node children обходятся так же, как `container.children`.
- [x] В validate: убрать правило “runtime-registered nodes MUST NOT have children”.
- [x] Сохранить правило для prefab references отдельно, если prefab-ref children всё ещё запрещены.
- [x] Добавить тест: custom `Panel` с `children` build/apply работает.
- [x] Документировать: base fields зарезервированы для всех узлов (`id/type/label/x/y/.../children/mask`). Custom типы не должны переиспользовать их под другой смысл.

## 3. Чёткая семантика `apply()`

- [x] Явно задокументировать: `apply()` — patch semantics.
- [x] Отсутствующее поле не сбрасывает старое значение.
- [x] Отсутствующий child не удаляет live child.
- [x] Type mismatch silent: type-specific assign может skip, base fields всё равно применяются.
- [x] Missing child → `onMissing`, subtree skipped.
- [x] Проверить и зафиксировать тестами поведение удаления/отсутствия `mask`.
- [x] Проверить и зафиксировать тестами поведение удаления/смены `label`.
- [x] Не добавлять `mode: "full"` сейчас; оставить в roadmap.

## 4. Intrinsic types: стабильная Pixi-база

- [ ] Сначала довести текущие built-ins до точной и протестированной семантики:
  - [ ] `container`: base/pivot fields.
  - [ ] `sprite`: `texture`, `frame`, `tint`, `width`, `height`, `anchor`.
  - [ ] `text`: `style`, `maxWidth`, решить судьбу `fit` — реализовать или убрать.
  - [ ] `graphics`: все shape cases, ошибки неполных shape fields.
  - [ ] `slot`: реализовать/описать `width` и `height`.
- [ ] Решить судьбу `spine`: скорее убрать из default intrinsic support и оставить через custom `nodeTypes`.
- [ ] Затем расширить PXD v1 intrinsic набор практичными Pixi v8 типами:
  - [ ] `nineSliceSprite`.
  - [ ] `tilingSprite`.
  - [ ] `animatedSprite`.
  - [ ] `bitmapText`.
- [ ] Не добавлять engine/game-specific типы в базу: buttons, reels, layout controllers, Spine/game objects — через custom `nodeTypes`.

## 5. Descriptor как source of truth для intrinsic structure

- [ ] Ввести простой TS descriptor layer для intrinsic node structure: fields, required fields, decidable flags, composable flag.
- [ ] Использовать descriptor для:
  - [ ] `INTRINSIC` списка;
  - [ ] `NON_COMPOSABLE` списка;
  - [ ] validation required/type checks;
  - [ ] JSON Schema generation.
- [ ] Не переносить Pixi behavior в descriptor: `create/assign` оставить ручным читаемым кодом в `nodeTypes.ts`.
- [ ] Добавить `npm run generate:schema`.
- [ ] Генерировать `pxd.schema.json` из descriptor.
- [ ] Добавить тест, что generated schema совпадает с committed `pxd.schema.json`.
- [ ] Позже рассмотреть генерацию markdown-таблиц для docs из descriptor.

## 6. Validation/schema policy

- [ ] Built-in intrinsic nodes strict: unknown fields запрещены.
- [ ] Custom nodes open: дополнительные top-level поля разрешены.
- [ ] Custom top-level scalar fields могут быть decision maps и автоматически resolve-ятся.
- [ ] Structural fields не decidable: `id`, `type`, `mask`, `children`, `extensions`, `points`.
- [ ] Base fields валидируются одинаково для intrinsic и custom nodes.
- [ ] Semantic-only rules остаются в `validate()`, даже если JSON Schema их не выражает.

## 7. Extensions — roadmap, не текущая архитектура

- [ ] Не развивать extension runtime API сейчас.
- [ ] Не строить архитектуру вокруг `extensionsUsed/extensionsRequired`.
- [ ] Оставить тему extensions в roadmap как следующую итерацию/версию, если появится реальная потребность.
- [ ] В текущих docs убрать extensions из основного mental model.
- [ ] Решить отдельно: оставить opaque ignored fields для spec-compat или удалить в будущей breaking версии.

## 8. CLI и tooling

- [ ] Добавить `bin` entry в `package.json`.
- [ ] Реализовать `pxd validate <file>`.
- [ ] Реализовать понятные ошибки validation/schema.
- [ ] Реализовать `pxd inspect <file>` для краткого дерева/статистики.
- [ ] Добавить CLI tests.
- [ ] CLI не должен усложнять runtime и не должен быть dependency runtime API.

## 9. Examples и проверяемые демо

- [ ] Минимальный browser example.
- [ ] Custom node type example без `props`, с top-level custom fields.
- [ ] Custom composable node example.
- [ ] Hot reload/apply patch example.
- [ ] Slots example.
- [ ] Prefabs example.
- [ ] Проверять examples в build/CI.

## 10. CI / качество

- [ ] Добавить GitHub Actions для `npm ci`, `npm test`, `npm pack --dry-run`.
- [ ] Добавить `typecheck` script как отдельную команду.
- [ ] Решить lint/format: добавить или явно отказаться.
- [ ] Добавить changelog/release notes.
- [ ] Проверять, что `npm pack --dry-run` публикует только нужные файлы.

## 11. Документация

- [ ] README переписать вокруг нового mental model: маленький API + `nodeTypes` как расширение.
- [ ] Guides обновить под custom top-level fields и custom children.
- [ ] В docs явно описать reserved base fields.
- [ ] В docs явно описать patch semantics `apply()`.
- [ ] В docs явно описать, что custom fields валидирует пользователь/движок.
- [ ] В docs не обещать extensions/reconcile/full apply до реализации.

## 12. Будущее, не минимум

- [ ] `apply(doc, root, { mode: "full" })` — full field reset semantics.
- [ ] Reconcile с добавлением/удалением/replacement children.
- [ ] Lifecycle hooks для custom node types: cleanup/destroy перед reconcile/replacement.
- [ ] Extension API, если custom node types перестанут покрывать реальные сценарии.
- [ ] Tree → PXD serialization.
