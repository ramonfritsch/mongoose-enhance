# `mongoose-enhance`

Bunch of plugins and helpers to enhance mongoose and build better models and relationships. Use at your own risk.

Tested and currently in prod on https://savee.it/

## Migrate 1.x.x -> 2.x.x

### `mongoose.enhance.plugins.derived`

When `method: 'count'` or `method: 'sum'`:

- Option `model` is renamed to `foreignModelName`
- Option `localKey` is renamed to `localField`
