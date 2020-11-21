const _ = require('lodash');

module.exports = (mongoose) => {
	function noop() {}

	function wrapPreCallback(callback, fn) {
		if (callback.length === 0) {
			return function () {
				const doc = this;

				return fn(doc, () => callback.call(doc));
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
			return function (doc) {
				return fn(doc, () => callback.call(doc), noop);
			};
		} else {
			return function (doc, next) {
				return fn(doc, () => callback.call(doc, next), next);
			};
		}
	}

	mongoose.enhance.registerPlugin((schema) => {
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

		schema.whenPostNew = function (callback) {
			schema.pre('save', function (next) {
				const doc = this;

				doc.$wasNew = doc.isNew;

				return next();
			});

			schema.post(
				'save',
				wrapPostCallback(callback, function (doc, callback, next) {
					if (!doc.$wasNew) {
						return next();
					}

					return callback();
				}),
			);
		};

		schema._whenModifieds = [];

		schema.oncePreCompile(function (schema) {
			const keys = _.uniq(
				schema._whenModifieds.reduce((sum, { keys }) => [...sum, ...keys], []),
			);

			schema.post('init', (doc) => {
				doc.$wasNew = doc.isNew;

				if (doc.isNew) {
					return;
				}

				keys.forEach((key) => doc.setOld(key));
			});

			schema._whenModifieds.forEach(({ pre, keys, callback }) => {
				let hook = pre ? schema.pre : schema.post;
				let wrapper = pre ? wrapPreCallback : wrapPostCallback;

				hook.call(
					schema,
					'save',
					wrapper(callback, function (doc, callback, next) {
						if (doc.isNew || doc.$wasNew) {
							return next();
						}

						const isModified = keys.some(
							(key) => doc.isModified(key) && doc.getOld(key) !== doc.get(key),
						);

						if (isModified) {
							return callback();
						}

						return next();
					}),
				);
			});

			schema.post('save', function (doc) {
				keys.forEach((key) => doc.setOld(key));
				doc.$wasNew = false;
			});
		});

		schema.whenModified = function (keys, callback) {
			keys = Array.isArray(keys) ? keys : [keys];

			schema._whenModifieds.push({
				pre: true,
				keys,
				callback,
			});
		};

		schema.whenPostModified = function (keys, callback) {
			keys = Array.isArray(keys) ? keys : [keys];

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
				wrapPreCallback(callback, function (doc, callback) {
					return callback();
				}),
			);
		};

		schema.whenPostRemoved = function (callback) {
			schema.post(
				'remove',
				wrapPostCallback(callback, function (doc, callback) {
					return callback();
				}),
			);
		};
	});
};
