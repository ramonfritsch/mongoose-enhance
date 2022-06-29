const pLimit = require('p-limit');

module.exports = (mongoose) => {
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

	const createUpdater =
		(queryFn) =>
		async (localModel, foreignModel, spec, entryOrEntryID, save = true) => {
			if (!entryOrEntryID) {
				return;
			}

			// if (shouldSkip(localModel, foreignModel, spec, entryOrEntryID)) {
			// 	return;
			// }

			const entry = await localModel.ensureModel(entryOrEntryID);

			if (!entry) {
				return;
			}

			const value = await queryFn(foreignModel, spec, entry);

			if (entry.get(spec.localField) === value) {
				return;
			}

			entry.set(spec.localField, value);

			// TODO: perf: Should we use a barebones mongo update instead? This fires all the side effects
			// or have an opt-in option to enable this behavior when we have a chain dependency, or even better
			// detect when we have a chain dependency and use a the .save() method only if necessary.
			const r = save ? await entry.save() : null;

			return r;
		};

	const updateCount = createUpdater(async (foreignModel, spec, entry) => {
		const count = await foreignModel.countDocuments({
			[spec.foreignKey]: entry.get(spec.localKey),
			...(spec.query ? spec.query(entry) : {}),
		});

		return count;
	});

	const updateSum = createUpdater(async (foreignModel, spec, entry) => {
		const entries = await foreignModel.find({
			[spec.foreignKey]: entry.get(spec.localKey),
			...(spec.query ? spec.query(entry) : {}),
		});

		const sum = entries.reduce((sum, entry) => sum + entry.get(spec.foreignSumKey), 0);

		return sum;
	});

	const updateCustom = createUpdater(async (foreignModel, spec, entry) => {
		return await spec.query(entry);
	});

	const allDeriveds = [];
	let synchingPromise = null;
	// let syncDone = {};

	mongoose.enhance.plugins.derived = function (schema, options) {
		mongoose.enhance.onceSchemasAreReady(() => {
			schema.methods.syncDerived = async function () {
				const model = mongoose.model(schema.modelName);
				const limitRun = pLimit(6);

				const infos = allDeriveds.filter(
					(info) => info.localModelName === schema.modelName,
				);

				await Promise.all(infos.map(({ run }) => limitRun(() => run(this))));

				if (this.isModified()) {
					await model.collection.updateOne({ _id: this._id }, this.getChanges(), {
						upsert: false,
					});
				}

				return this;
			};

			options.forEach((spec) => {
				const isNumeric = spec.method === 'count' || spec.method === 'sum';
				const foreignSchema = mongoose.enhance.schemas[spec.foreignModelName];

				spec.localKey = spec.localKey || '_id';
				spec.defaultValue = spec.defaultValue || (isNumeric ? 0 : null);

				if (spec.method === 'count' || spec.method === 'sum' || spec.method === 'custom') {
					const updateFn =
						spec.method === 'count'
							? updateCount
							: spec.method === 'sum'
							? updateSum
							: updateCustom;

					schema.whenNew(function () {
						this.set(spec.localField, spec.defaultValue);
					});

					const watchedFields = [spec.foreignKey];

					if (spec.method === 'sum') {
						watchedFields.push(spec.foreignSumKey);
					}

					foreignSchema.whenPostModifiedOrNew(watchedFields, async function () {
						if (synchingPromise) {
							return;
						}

						const operations = [];

						if (
							this.getOld(spec.foreignKey) &&
							this.getOld(spec.foreignKey) !== this.get(spec.foreignKey)
						) {
							operations.push(
								updateFn(
									mongoose.model(schema.modelName),
									this.constructor,
									spec,
									this.getOld(spec.foreignKey),
								),
							);
						}

						operations.push(
							updateFn(
								mongoose.model(schema.modelName),
								this.constructor,
								spec,
								this.get(spec.foreignKey),
							),
						);

						await Promise.all(operations);
					});

					foreignSchema.whenPostRemoved(function () {
						return updateFn(
							mongoose.model(schema.modelName),
							this.constructor,
							spec,
							this.get(spec.foreignKey),
						);
					});

					allDeriveds.push({
						localModelName: schema.modelName,
						spec,
						run: async (entry) => {
							return updateFn(
								mongoose.model(schema.modelName),
								mongoose.model(spec.foreignModelName),
								spec,
								entry,
								false /* save */,
							);
						},
					});
				}
			});
		});
	};

	// Generate derived data on all models
	mongoose.enhance.syncDerived = async function (options = {}) {
		if (synchingPromise) {
			return synchingPromise;
		}

		synchingPromise = new Promise((resolve, reject) => {
			const infosByModelName = allDeriveds.reduce((sum, info) => {
				if (!sum[info.localModelName]) {
					sum[info.localModelName] = [];
				}

				sum[info.localModelName].push(info);

				return sum;
			}, {});

			const limitModel = pLimit(4);
			const limitRun = pLimit(60);

			Promise.all(
				Object.keys(infosByModelName).map((localModelName) =>
					limitModel(() => {
						const model = mongoose.model(localModelName);
						const infos = infosByModelName[localModelName];

						let count = 0;

						return mongoose.cursorEachAsyncLimit(
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
									infos.map(({ run }) => limitRun(() => run(entry))),
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
				.then(resolve)
				.catch(reject);
		});

		let promise = synchingPromise;

		synchingPromise = null;
		// syncDone = {};

		return promise;
	};
};
