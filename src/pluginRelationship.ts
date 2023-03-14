import pLimit from 'p-limit';
import mongoose, { EnhancedEntry, EnhancedModel, EnhancedSchema, Types } from '.';

async function removeIfNotReferenced(
	localModel: EnhancedModel<any>,
	foreignModel: EnhancedModel<any>,
	localKey: string,
	entryOrEntryID: EnhancedEntry<any> | Types.ObjectId,
) {
	const count = await localModel.countDocuments({
		[localKey]: mongoose.id(entryOrEntryID),
	});

	if (count > 0) {
		return;
	}

	const entry = await foreignModel.ensureEntry(entryOrEntryID);

	if (!entry) {
		return;
	}

	return entry.remove();
}

const allRelationships: Array<{
	type: 'hasMany' | 'manyToOne';
	localModelName: string;
	localKey: string;
	foreignModelName: string;
	foreignKey: string;
}> = [];

export type Schema = {
	hasMany: (foreignModelName: string, foreignKey: string, localKey?: string) => void;
	manyToOne: (foreignModelName: string, localKey: string, foreignKey?: string) => void;
};

// Remove orphan entries
export const syncRelationships = async function () {
	const limitRelationship = pLimit(2);

	await Promise.all(
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

export default function pluginRelationship<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.hasMany = function (
		foreignModelName: string,
		foreignKey: string,
		localKey: string = '_id',
	) {
		schema.whenRemoved(async function () {
			const foreignModel = mongoose.model(foreignModelName);
			const entries = await foreignModel.find({
				[foreignKey]: this.get(localKey),
			});

			const limit = pLimit(5);
			await Promise.all(entries.map((entry) => limit(() => entry.remove())));
		});

		allRelationships.push({
			type: 'hasMany',
			localModelName: schema.modelName,
			localKey,
			foreignModelName,
			foreignKey,
		});
	};

	// Remove if no one else references it
	schema.manyToOne = function (
		foreignModelName: string,
		localKey: string,
		foreignKey: string = '_id',
	) {
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

		allRelationships.push({
			type: 'manyToOne',
			localModelName: schema.modelName,
			localKey,
			foreignModelName,
			foreignKey,
		});
	};
}
