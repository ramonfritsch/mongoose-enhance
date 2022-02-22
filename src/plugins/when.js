const _ = require('lodash');

module.exports = (mongoose) => {
	function noop() {}

	function wrapPreCallback(callback, fn) {
		if (callback.length === 0) {
			return function () {
				const doc = this;

				return fn(doc, () => callback.call(doc), noop);
			};
		} else {
			return function (next) {
				const doc = this;

				return fn(doc, () => callback.call(doc, next), next);
			};
		}
	}

	function wrapPostCallback(callback, fn) {
		if (callback.length === 0) {
			return (doc) => fn(doc, () => callback.call(doc), noop);
		} else {
			return (doc, next) => fn(doc, () => callback.call(doc, next), next);
		}
	}

	mongoose.enhance.registerGlobalPlugin((schema) => {
		schema.whenNew = function (callback) {
			schema.pre(
				'save',
				wrapPreCallback(callback, function (doc, callback, next) {
					if (!doc.isNew) {
						return next();
					}

					return callback();
				}),
			);
		};

		schema._whenPostNews = [];
		schema._whenModifieds = [];

		schema.oncePreCompile(function (schema) {
			const keys = _.uniq(
				schema._whenModifieds.reduce((sum, { keys }) => [...sum, ...keys], []),
			);

			schema.post('init', (doc) => {
				if (doc.isNew) {
					return;
				}

				keys.forEach((key) => doc.setOld(key));
			});

			schema.pre('save', function () {
				this.$locals.wasNew = this.isNew;
				this.$locals.needsPostSave = false;

				this.setWasModified();

				keys.forEach((key) => this.setWasModified(key));
			});

			schema.post('save', function (doc) {
				if (!doc.$locals.originalSave) {
					doc.$locals.originalSave = doc.save;

					doc.save = () => {
						doc.$locals.needsPostSave = true;

						return Promise.resolve(doc);
					};
				}
			});

			schema._whenPostNews.forEach(({ callback }) => {
				schema.post(
					'save',
					wrapPostCallback(callback, function (doc, callback, next) {
						if (!doc.$locals.wasNew) {
							return next();
						}

						return callback();
					}),
				);
			});

			schema._whenModifieds.forEach(({ pre, keys, callback }) => {
				const hook = pre ? schema.pre.bind(schema) : schema.post.bind(schema);
				const wrapCallback = pre ? wrapPreCallback : wrapPostCallback;

				hook.call(
					schema,
					'save',
					wrapCallback(callback, function (doc, callback, next) {
						if (doc.isNew || doc.$locals.wasNew) {
							return next();
						}

						const isModified = keys.some(
							(key) =>
								(pre ? doc.isModified(key) : doc.wasModified(key)) &&
								doc.getOld(key) !== doc.get(key),
						);

						if (isModified) {
							return callback();
						}

						return next();
					}),
				);
			});

			schema.post('save', function (doc) {
				keys.forEach((key) => {
					doc.setOld(key);
					doc.clearWasModified(key);
				});

				doc.clearWasModified();

				doc.$locals.wasNew = false;

				if (doc.$locals.originalSave) {
					doc.save = doc.$locals.originalSave.bind(doc);
					doc.$locals.originalSave = null;
				}

				if (doc.$locals.needsPostSave) {
					return doc.save();
				}
			});

			schema._whenPostNews = [];
			schema._whenModifieds = [];
		});

		schema.whenPostNew = function (callback) {
			schema._whenPostNews.push({
				callback,
			});
		};

		schema.whenSave = function (callback) {
			schema.pre(
				'save',
				wrapPreCallback(callback, (doc, callback) => callback()),
			);
		};

		schema.whenPostSave = function (callback) {
			schema.post(
				'save',
				wrapPostCallback(callback, (doc, callback) => callback()),
			);
		};

		schema.whenSaveError = function (callback) {
			schema.post('save', function (error, doc, next) {
				if (callback.length === 1) {
					return callback.call(doc, error);
				} else {
					return callback.call(doc, error, next);
				}
			});
		};

		schema.whenModified = function (keyOrKeys, callback) {
			const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

			schema._whenModifieds.push({
				pre: true,
				keys,
				callback,
			});
		};

		schema.whenPostModified = function (keyOrKeys, callback) {
			const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];

			schema._whenModifieds.push({
				pre: false,
				keys,
				callback,
			});
		};

		schema.whenModifiedOrNew = function (keys, callback) {
			schema.whenNew.call(this, callback);
			schema.whenModified.call(this, keys, callback);
		};

		schema.whenPostModifiedOrNew = function (keys, callback) {
			schema.whenPostNew.call(this, callback);
			schema.whenPostModified.call(this, keys, callback);
		};

		schema.whenRemoved = function (callback) {
			schema.pre(
				'remove',
				wrapPreCallback(callback, (doc, callback) => callback()),
			);
		};

		schema.whenPostRemoved = function (callback) {
			schema.post(
				'remove',
				wrapPostCallback(callback, (doc, callback) => callback()),
			);
		};
	});
};
