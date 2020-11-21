const pLimit = require('p-limit');

module.exports = (mongoose) => {
	async function removeIfNotReferenced(localModel, foreignModel, localKey, entryOrEntryID) {
		const count = await localModel.countDocuments({
			[localKey]: mongoose.id(entryOrEntryID),
		});

		if (count > 0) {
			return;
		}

		const entry = await foreignModel.ensureModel(entryOrEntryID);

		if (!entry) {
			return;
		}

		return entry.remove();
	}

	const allRelationships = [];

	mongoose.enhance.registerPlugin((schema) => {
		schema.hasMany = function (foreignModelName, foreignKey, localKey = '_id') {
			schema.whenRemoved(async function () {
				const foreignModel = mongoose.model(foreignModelName);
				const entries = await foreignModel.find({
					[foreignKey]: this.get(localKey),
				});

				const limit = pLimit(5);
				return Promise.all(entries.map((entry) => limit(() => entry.remove())));
			});

			mongoose.enhance.onceSchemasAreReady(() => {
				allRelationships.push({
					type: 'hasMany',
					localModelName: schema.modelName,
					localKey,
					foreignModelName,
					foreignKey,
				});
			});
		};

		// Remove if no one else references it
		schema.manyToOne = function (foreignModelName, localKey, foreignKey = '_id') {
			schema.whenPostModified(localKey, function () {
				return removeIfNotReferenced(
					mongoose.model(schema.modelName),
					mongoose.model(foreignModelName),
					localKey,
					mongoose.id(this.getOld(localKey)),
				);
			});

			schema.whenPostRemoved(function () {
				return removeIfNotReferenced(
					mongoose.model(schema.modelName),
					mongoose.model(foreignModelName),
					localKey,
					mongoose.id(this.get(localKey)),
				);
			});

			mongoose.enhance.onceSchemasAreReady(() => {
				allRelationships.push({
					type: 'manyToOne',
					localModelName: schema.modelName,
					localKey,
					foreignModelName,
					foreignKey,
				});
			});
		};
	});

	// Remove orphan entries
	mongoose.enhance.syncRelationships = async function () {
		const limitRelationship = pLimit(2);

		return Promise.all(
			allRelationships.map((info) =>
				limitRelationship(() => {
					const localModel = mongoose.model(info.localModelName);
					const foreignModel = mongoose.model(info.foreignModelName);

					return mongoose.cursorEachAsyncLimit(
						20,
						foreignModel.find({}).cursor({
							batchSize: 10000,
							useMongooseAggCursor: true,
						}),
						async (entry) => {
							if (info.type === 'hasMany') {
								const count = await localModel.countDocuments({
									[info.localKey]: entry.get(info.foreignKey),
								});

								if (count == 0) {
									return entry.remove();
								}
							} else if (info.type === 'manyToOne') {
								return removeIfNotReferenced(
									localModel,
									foreignModel,
									info.localKey,
									entry,
								);
							}
						},
					);
				}),
			),
		);
	};
};
