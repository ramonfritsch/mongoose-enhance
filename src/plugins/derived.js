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

	async function updateCount(localModel, foreignModel, spec, entryOrEntryID, save = true) {
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

		const count = await foreignModel.countDocuments({
			[spec.foreignKey]: entry._id,
			...(spec.query ? spec.query(entry) : {}),
		});

		// TODO: Rename localKey to localField, localKey is _id by default
		if (entry.get(spec.localKey) === count) {
			return;
		}

		entry.set(spec.localKey, count);

		return save ? entry.save() : null;
	}

	async function updateSum(localModel, foreignModel, spec, entryOrEntryID, save = true) {
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

		const entries = await foreignModel.find({
			[spec.foreignKey]: entry._id,
			...(spec.query ? spec.query(entry) : {}),
		});

		const sum = entries.reduce((sum, entry) => sum + entry.get(spec.foreignSumKey), 0);

		if (entry.get(spec.localKey) === sum) {
			return;
		}

		entry.set(spec.localKey, sum);

		return save ? entry.save() : null;
	}

	const allRuns = [];
	let synchingPromise = null;
	let syncDone = {};

	mongoose.enhance.plugins.derived = function (schema, options) {
		mongoose.enhance.onceSchemasAreReady(() => {
			options.forEach((spec) => {
				// TODO: Rename model to foreignModelName
				const foreignSchema = mongoose.enhance.schemas[spec.model];

				if (spec.method === 'count' || spec.method === 'sum') {
					const updateFn = spec.method === 'count' ? updateCount : updateSum;

					schema.whenNew(function () {
						this.set(spec.localKey, 0);
					});

					foreignSchema.whenPostModifiedOrNew(spec.foreignKey, async function () {
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

						return Promise.all(operations);
					});

					foreignSchema.whenPostRemoved(function () {
						return updateFn(
							mongoose.model(schema.modelName),
							this.constructor,
							spec,
							this.get(spec.foreignKey),
						);
					});

					allRuns.push({
						localModelName: schema.modelName,
						localField: spec.localKey,
						foreignModelName: spec.model,
						run: async (entry) => {
							return updateFn(
								mongoose.model(schema.modelName),
								mongoose.model(spec.model),
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
			const runsByModelName = allRuns.reduce((sum, info) => {
				if (!sum[info.localModelName]) {
					sum[info.localModelName] = [];
				}

				sum[info.localModelName].push(info);

				return sum;
			}, {});

			const limitModel = pLimit(4);
			const limitRun = pLimit(60);

			Promise.all(
				Object.keys(runsByModelName).map((localModelName) =>
					limitModel(() => {
						const model = mongoose.model(localModelName);
						const runs = runsByModelName[localModelName];

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
									runs.map(({ run }) => limitRun(() => run(entry))),
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
		syncDone = {};

		return promise;
	};
};
