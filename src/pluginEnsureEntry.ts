import mongoose, {
	EnhancedEntry,
	EnhancedModel,
	EnhancedSchema,
	ExtractEntryType,
	ObjectId,
} from '.';

export type Statics<TEntry extends EnhancedEntry> = {
	ensureEntry: (entryOrID: TEntry | ObjectId) => Promise<TEntry>;
};

export default function pluginEnsureEntry<TModel extends EnhancedModel>(
	schema: EnhancedSchema<TModel>,
) {
	schema.statics.ensureEntry = function (
		entryOrID: ExtractEntryType<TModel> | ObjectId,
	): Promise<ExtractEntryType<TModel>> {
		if (mongoose.isEntry(entryOrID)) {
			return Promise.resolve(entryOrID);
		}

		return this.findOne({
			_id: mongoose.id(entryOrID),
		});
	} as Statics<ExtractEntryType<TModel>>['ensureEntry'];
}
