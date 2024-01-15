import pLimit from 'p-limit';
import mongoose, {
	AnyObject,
	EnhancedEntry,
	EnhancedModel,
	EnhancedSchema,
	ExtractEntryType,
	Types,
} from '.';

export type Methods = {
	syncDerived: () => Promise<void>;
};

type Spec<TEntry extends EnhancedEntry<AnyObject>> = {
	localField: string;
	defaultValue?: number;
} & (
	| {
			method: 'count';
			foreignKey: string;
			foreignModelName: string;
			localKey?: string;
	  }
	| {
			method: 'sum';
			foreignKey: string;
			foreignModelName: string;
			foreignSumKey: string;
			localKey?: string;
	  }
	| {
			method: 'custom';
			calculate: (entry: TEntry) => Promise<any>;
			subscribeInvalidations: (
				invalidate: (
					entryOrEntryID: Types.ObjectId | TEntry | null | undefined,
					save?: boolean,
				) => Promise<void>,
			) => void;
	  }
);

type AllDerivedInfo = {
	localModelName: string;
	invalidate: (
		entryOrEntryID: Types.ObjectId | ExtractEntryType<EnhancedModel<any>> | null | undefined,
		save?: boolean,
	) => Promise<void>;
};

const allDeriveds: Array<AllDerivedInfo> = [];
let synchingPromise: Promise<void> | null = null;
// let syncDone = {};

// Generate derived data on all models
export const syncDerived = async function (options: { log?: boolean } = {}) {
	if (synchingPromise) {
		return synchingPromise;
	}

	synchingPromise = new Promise((resolve, reject) => {
		const infosByModelName = allDeriveds.reduce(
			(sum: Record<string, AllDerivedInfo[]>, info) => {
				if (!sum[info.localModelName]) {
					sum[info.localModelName] = [];
				}

				sum[info.localModelName].push(info);

				return sum;
			},
			{},
		);

		const limitModel = pLimit(4);
		const limitInvalidate = pLimit(60);

		Promise.all(
			Object.keys(infosByModelName).map((localModelName) =>
				limitModel(async () => {
					const model = mongoose.model(localModelName);
					const infos = infosByModelName[localModelName];

					let count = 0;

					await mongoose.cursorEachAsyncLimit(
						20,
						model.find({}).cursor({
							batchSize: 10000,
							useMongooseAggCursor: true,
						}),
						async (entry) => {
							if (options.log) {
								console.log(localModelName, count++);
							}

							await Promise.all(
								infos.map(({ invalidate }) =>
									limitInvalidate(() => invalidate(entry, false /* save */)),
								),
							);

							if (entry.isModified()) {
								await model.collection.updateOne(
									{ _id: entry._id },
									entry.getChanges(),
									{
										upsert: false,
									},
								);
							}
						},
					);
				}),
			),
		)
			.then(() => resolve())
			.catch(reject);
	});

	let promise = synchingPromise;

	synchingPromise = null;
	// syncDone = {};

	return promise;
};

export default function externalPluginDerived<
	TSchema extends EnhancedSchema<TModel>,
	TModel extends EnhancedModel<AnyObject>,
	TEntry extends ExtractEntryType<TModel> = ExtractEntryType<TModel>,
>(schema: TSchema, options: Readonly<Array<Spec<TEntry>>>) {
	// function shouldSkip(localModel, foreignModel, spec, entryOrEntryID) {
	// 	if (!synchingPromise) {
	// 		return false;
	// 	}

	// 	const cacheKey =
	// 		localModel.name +
	// 		'-' +
	// 		foreignModel.name +
	// 		'-' +
	// 		spec.foreignKey +
	// 		'-' +
	// 		String(mongoose.id(entryOrEntryID));
	// 	if (syncDone[cacheKey]) {
	// 		return true;
	// 	}

	// 	syncDone[cacheKey] = true;
	// 	return false;
	// }

	schema.methods.syncDerived = async function () {
		const model = mongoose.model(schema.modelName);
		const limitRun = pLimit(6);

		const infos = allDeriveds.filter((info) => info.localModelName === schema.modelName);

		await Promise.all(infos.map(({ invalidate }) => limitRun(() => invalidate(this))));

		if (this.isModified()) {
			await model.collection.updateOne({ _id: this._id }, this.getChanges(), {
				upsert: false,
			});
		}

		return this;
	};

	options.forEach((spec) => {
		const method = spec.method;
		const localKey = method === 'count' || method === 'sum' ? spec.localKey || '_id' : '_id';
		const defaultValue = spec.defaultValue || 0;

		schema.whenNew(function () {
			this.set(spec.localField, defaultValue);
		});

		let calculate: (entry: TEntry) => Promise<any>;
		let subscribeInvalidations: (
			invalidate: (
				entryOrEntryID: Types.ObjectId | TEntry | null | undefined,
				save?: boolean,
			) => Promise<void>,
		) => void;

		if (method === 'count' || method === 'sum') {
			if (method === 'count') {
				calculate = async (entry) => {
					return mongoose.model(spec.foreignModelName).countDocuments({
						[spec.foreignKey]: entry.get(localKey),
					});
				};
			} else {
				calculate = async (entry) => {
					const entries = await mongoose.model(spec.foreignModelName).find({
						[spec.foreignKey]: entry.get(localKey),
					});

					return entries.reduce((sum, entry) => sum + entry.get(spec.foreignSumKey), 0);
				};
			}

			subscribeInvalidations = (invalidate) => {
				const watchedFields = [spec.foreignKey];

				if (spec.method === 'sum') {
					watchedFields.push(spec.foreignSumKey);
				}

				mongoose.enhance.onceSchemaIsReady(spec.foreignModelName, (foreignSchema) => {
					foreignSchema.whenPostModifiedOrNew(watchedFields, async function () {
						if (synchingPromise) {
							return;
						}

						const operations: Array<Promise<any>> = [];

						if (
							this.getOld(spec.foreignKey) &&
							this.getOld(spec.foreignKey) !== this.get(spec.foreignKey)
						) {
							operations.push(invalidate(this.getOld(spec.foreignKey)));
						}

						operations.push(invalidate(this.get(spec.foreignKey)));

						await Promise.all(operations);
					});

					foreignSchema.whenPostRemoved(function () {
						return invalidate(this.get(spec.foreignKey));
					});
				});
			};
		} else {
			calculate = spec.calculate;
			subscribeInvalidations = spec.subscribeInvalidations;
		}

		const invalidate = async (
			entryOrEntryID: Types.ObjectId | TEntry | null | undefined,
			save: boolean = true,
		) => {
			if (!entryOrEntryID) {
				return;
			}

			// if (shouldSkip(mongoose.model(schema.modelName), mongoose.model(spec.foreignModelName), spec, entryOrEntryID)) {
			// 	return;
			// }

			const entry = await mongoose
				.model<TModel>(schema.modelName)
				.ensureEntry(entryOrEntryID);

			if (!entry) {
				return;
			}

			const value = await calculate(entry as TEntry);

			if (entry.get(spec.localField) === value) {
				return;
			}

			entry.set(spec.localField, value);

			// TODO: perf: Should we use a bare bones mongo update instead? This fires all the side effects
			// or have an opt-in option to enable this behavior when we have a chain dependency, or even better
			// detect when we have a chain dependency and use a the .save() method only if necessary.
			if (save) {
				await entry.save();
			}
		};

		subscribeInvalidations(invalidate);

		allDeriveds.push({
			localModelName: schema.modelName,
			invalidate,
		});
	});
}
