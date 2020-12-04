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
			return function (doc) {
				// let doc = this;

				// while (doc.parent) {
				// 	doc = doc.parent;
				// }

				return fn(doc, () => callback.call(doc), noop);
			};
		} else {
			return function (doc, next) {
				// let doc = this;

				// while (doc.parent) {
				// 	doc = doc.parent;
				// }

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
				if (doc.isNew) {
					return;
				}

				keys.forEach((key) => doc.setOld(key));
			});

			schema.pre('save', function () {
				this.$locals.wasNew = this.isNew;

				this.setWasModified();

				keys.forEach((key) => this.setWasModified(key));
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

						// if (!pre) {
						// 	console.log(
						// 		'post save',
						// 		'is/wasMod(key):',
						// 		isModified,
						// 		'key:',
						// 		keys[0],
						// 		'is',
						// 		doc.isModified(keys[0]),
						// 		'was',
						// 		doc.wasModified(keys[0]),
						// 		doc.getOld(keys[0]),
						// 		doc.get(keys[0]),
						// 	);
						// }

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
