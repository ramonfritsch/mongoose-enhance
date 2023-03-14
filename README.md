# `mongoose-enhance`

Bunch of plugins and helpers to enhance mongoose and build better models and relationships. Now with TypeScript support.

Use at your own risk.

Currently in prod on https://savee.it/

## Migrate 2.x.x -> 3.x.x

### `mongoose.createSchema`

Schemas are now created using the `mongoose.createSchema` method.

### `onceSchemasAreReady`

`onceSchemasAreReady` is now per schema with `onceSchemaIsReady`.

### `onceModelsAreReady`

`onceModelsAreReady` is now per model with `onceModelIsReady`.

### `ensureModel`

`ensureModel` is now renamed to `ensureEntry`.

### Extra types

Extra types are now on `mongoose.SchemaTypes`.

## Migrate 1.x.x -> 2.x.x

### `mongoose.enhance.plugins.derived`

When `method: 'count'` or `method: 'sum'`:

-   Option `model` is renamed to `foreignModelName`
-   Option `localKey` is renamed to `localField`
