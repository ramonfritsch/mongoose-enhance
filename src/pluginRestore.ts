import { EnhancedModel, EnhancedSchema } from '.';

export type Methods = {
	restore: () => Promise<void>;
};

export default function pluginRestore<TModel extends EnhancedModel>(
	schema: EnhancedSchema<TModel>,
) {
	schema.methods.restore = async function () {
		const entry = await (this.constructor as TModel).findOne({
			_id: this._id,
		});

		if (entry) {
			this.set(entry);
		}

		return this;
	};
}
