import mongoose, { EnhancedEntry, EnhancedModel, EnhancedSchema, ExtractEntryType, Types } from '.';

export type Statics<TEntry extends EnhancedEntry<any>> = {
	ensureEntry: (entryOrID: TEntry | Types.ObjectId) => Promise<TEntry>;
};

export default function pluginEnsureEntry<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.statics.ensureEntry = function (
		entryOrID: ExtractEntryType<TModel> | Types.ObjectId,
	): Promise<ExtractEntryType<TModel> | null> {
		if (mongoose.isEntry(entryOrID)) {
			return Promise.resolve(entryOrID);
		}

		return this.findOne({
			_id: mongoose.id(entryOrID),
		}).exec();
	};
}
