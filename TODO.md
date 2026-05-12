# TODO: сделать `pxd` самодостаточной библиотекой

Цель: маленькая независимая Pixi.js-библиотека для чтения, построения и применения PXD-документов без зависимости от onearm.

## 1. Упаковка npm-пакета

- [x] Убрать `"private": true` из `package.json`.
- [x] Добавить `license`.
- [x] Добавить `repository`.
- [x] Добавить `exports` для ESM/import и типов.
- [x] Добавить `files`, чтобы публиковались только нужные файлы.
- [x] Добавить `clean` script для удаления `dist`.
- [x] Сделать `build` через clean rebuild.
- [x] Добавить `prepack`/`prepublishOnly`, чтобы пакет собирался перед публикацией.
- [x] Проверить `npm pack --dry-run`.

## 2. Чистые артефакты публикации

- [x] Не публиковать `node_modules`.
- [x] Не публиковать `dist/test`.
- [x] Не публиковать stale-файлы из старого `dist`.
- [x] Решить, публиковать ли `src` и `test`; если нет — исключить.
- [x] Оставить в пакете только runtime build, типы, README, spec/docs/schema.

## 3. Синхронизация документации и API

- [x] Везде заменить старые термины `builders`/`appliers` на `defaultNodeTypes`.
- [x] Везде использовать термин `assign`, не `patch`.
- [x] Проверить `README.md` на соответствие реальному API.
- [x] Проверить guides в `doc/guides/*`.
- [x] Проверить examples/reference docs.
- [x] Убрать из документации обещания, которые runtime пока не выполняет.

## 4. JSON Schema

- [ ] Добавить `pxd.schema.json`.
- [ ] Покрыть Core + Library level.
- [ ] Добавить schema для intrinsic node types.
- [ ] Добавить schema для decision maps.
- [ ] Добавить schema для prefabs.
- [ ] Добавить тесты, что fixtures проходят/падают по schema.

## 5. CLI

- [ ] Добавить `bin` entry в `package.json`.
- [ ] Реализовать `pxd validate <file>`.
- [ ] Реализовать понятные ошибки validation/schema.
- [ ] Добавить `pxd inspect <file>` для краткого дерева/статистики.
- [ ] Добавить CLI tests.

## 6. Чёткая семантика `apply()`

- [ ] Решить: `apply()` — это patch или full document apply.
- [ ] Если patch: явно задокументировать, что отсутствующие поля не сбрасываются.
- [ ] Если full apply: сбрасывать отсутствующие поля в defaults.
- [ ] Проверить поведение удаления `mask`.
- [ ] Проверить поведение удаления/смены `label`.
- [ ] Добавить тесты на удаление ранее заданных полей.

## 7. Довести базовые intrinsic-типы

- [ ] `container`: проверить все base/pivot поля.
- [ ] `sprite`: проверить texture/frame/tint/width/height/anchor.
- [ ] `text`: точно описать и протестировать `maxWidth`.
- [ ] `text.fit`: реализовать или убрать из заявленного API.
- [ ] `graphics`: проверить все shape cases и ошибки неполных shape fields.
- [ ] `slot`: реализовать/описать `width` и `height`.
- [ ] `spine`: либо реализовать через extension/custom type, либо убрать из default intrinsic support.

## 8. Extension API

- [ ] Добавить `extensions` handlers в build/apply options.
- [ ] Поддержать `extensionsRequired` через переданные handlers.
- [ ] Вызвать document-level extension hooks.
- [ ] Вызвать node-level extension hooks.
- [ ] Описать порядок выполнения относительно `NodeType.assign` и base fields.
- [ ] Добавить тесты на supported/required/ignored extensions.

## 9. Lifecycle для custom node types

- [ ] Добавить минимальные hooks, если нужны: `beforeAssign`, `afterAssign`.
- [ ] Добавить `destroy`/cleanup hook для будущего reconcile/rebuild.
- [ ] Задокументировать, что должно жить в `create`, а что в `assign`.
- [ ] Добавить тесты для hooks.

## 10. Examples и проверяемые демо

- [ ] Минимальный browser example.
- [ ] Custom node type example.
- [ ] Hot reload/apply example.
- [ ] Slots example.
- [ ] Проверять examples в build/CI.

## 11. CI / качество

- [ ] Добавить GitHub Actions для `npm ci`, `npm test`, `npm pack --dry-run`.
- [ ] Добавить lint/format или явно отказаться от них.
- [ ] Добавить typecheck как отдельный script.
- [ ] Добавить changelog/release notes.

## 12. Будущее, не минимум

- [ ] Scene level.
- [ ] Reconcile с добавлением/удалением children.
- [ ] Tree → PXD serialization.
- [ ] Producer tooling / Figma exporter.
