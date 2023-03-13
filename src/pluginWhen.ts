import _ from 'lodash';
import mongoose, { EnhancedModel, EnhancedSchema, ExtractEntryType } from '.';
import { ensureArray } from './utils';

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

type Callback<TModel extends EnhancedModel> =
	| ((this: ExtractEntryType<TModel>) => Promise<any> | any)
	| ((this: ExtractEntryType<TModel>, next: (err?: Error) => void) => Promise<any> | any);

export type Schema<TModel extends EnhancedModel> = {
	whenNew: (callback: Callback<TModel>) => void;
	whenPostNew: (callback: Callback<TModel>) => void;
	whenSave: (callback: Callback<TModel>) => void;
	whenPostSave: (callback: Callback<TModel>) => void;
	whenSaveError: (
		callback: (this: ExtractEntryType<TModel>, error: Error) => Promise<void> | void,
	) => void;
	whenModified: (keyOrKeys: string | string[], callback: Callback<TModel>) => void;
	whenPostModified: (keyOrKeys: string | string[], callback: Callback<TModel>) => void;
	whenModifiedOrNew: (keyOrKeys: string | string[], callback: Callback<TModel>) => void;
	whenPostModifiedOrNew: (keyOrKeys: string | string[], callback: Callback<TModel>) => void;
	whenRemoved: (callback: Callback<TModel>) => void;
	whenPostRemoved: (callback: Callback<TModel>) => void;
};

export default function pluginWhen<TModel extends EnhancedModel>(schema: EnhancedSchema<TModel>) {
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
	} as Schema<TModel>['whenNew'];

	schema.whenPostNew = function (callback) {
		_whenPostNews.push({
			callback,
		});
	} as Schema<TModel>['whenPostNew'];

	schema.whenSave = function (callback) {
		schema.pre(
			'save',
			wrapPreCallback(callback, (doc, callback) => callback()),
		);
	} as Schema<TModel>['whenSave'];

	schema.whenPostSave = function (callback) {
		schema.post(
			'save',
			wrapPostCallback(callback, (doc, callback) => callback()),
		);
	} as Schema<TModel>['whenPostSave'];

	schema.whenSaveError = function (callback) {
		schema.post('save', function (error, doc) {
			return callback.call(doc, error);
		});
	} as Schema<TModel>['whenSaveError'];

	schema.whenModified = function (keyOrKeys, callback) {
		const keys = ensureArray(keyOrKeys);

		_whenModifieds.push({
			pre: true,
			keys,
			callback,
		});
	} as Schema<TModel>['whenModified'];

	schema.whenPostModified = function (keyOrKeys, callback) {
		const keys = ensureArray(keyOrKeys);

		_whenModifieds.push({
			pre: false,
			keys,
			callback,
		});
	} as Schema<TModel>['whenPostModified'];

	schema.whenModifiedOrNew = function (keyOrKeys, callback) {
		schema.whenNew.call(this, callback);
		schema.whenModified.call(this, keyOrKeys, callback);
	} as Schema<TModel>['whenModifiedOrNew'];

	schema.whenPostModifiedOrNew = function (keyOrKeys, callback) {
		schema.whenPostNew.call(this, callback);
		schema.whenPostModified.call(this, keyOrKeys, callback);
	} as Schema<TModel>['whenPostModifiedOrNew'];

	schema.whenRemoved = function (callback) {
		schema.pre(
			'remove',
			wrapPreCallback(callback, (doc, callback) => callback()),
		);
	} as Schema<TModel>['whenRemoved'];

	schema.whenPostRemoved = function (callback) {
		schema.post(
			'remove',
			wrapPostCallback(callback, (doc, callback) => callback()),
		);
	} as Schema<TModel>['whenPostRemoved'];

	let _whenPostNews: Array<{ callback: Callback<TModel> }> = [];
	let _whenModifieds: Array<{
		pre: boolean;
		keys: string[];
		callback: Callback<TModel>;
	}> = [];

	mongoose.enhance._oncePreCompile(schema.modelName, function (schema) {
		const keys = _.uniq(
			_whenModifieds.reduce((sum: string[], { keys }) => [...sum, ...keys], []),
		);

		schema.post('init', (doc) => {
			if (doc.isNew) {
				return;
			}

			keys.forEach((key) => doc.setOld(key));
		});

		schema.pre<ExtractEntryType<TModel>>('save', function () {
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

		_whenPostNews.forEach(({ callback }) => {
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

		_whenModifieds.forEach(({ pre, keys, callback }) => {
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

		_whenPostNews = [];
		_whenModifieds = [];
	});
}
