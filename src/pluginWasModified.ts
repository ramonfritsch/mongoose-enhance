import { EnhancedModel, EnhancedSchema } from '.';

export type Methods = {
	setWasModified: (path?: string) => void;
	wasModified: (path?: string) => boolean;
	clearWasModified: (path?: string) => void;
};

export default function pluginWasModified<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.methods.setWasModified = function (path: string | undefined = undefined) {
		if (!this.$locals.wasModified) {
			this.$locals.wasModified = {};
		}

		if (this.$locals.wasModified) {
			this.$locals.wasModified[!path ? '$$doc' : path] = !path
				? this.isModified()
				: this.isModified(path);
		}
	};

	schema.methods.wasModified = function (path: string | undefined = undefined) {
		return this.$locals.wasModified ? this.$locals.wasModified[!path ? '$$doc' : path] : false;
	};

	schema.methods.clearWasModified = function (path: string | undefined = undefined) {
		if (this.$locals.wasModified) {
			delete this.$locals.wasModified[!path ? '$$doc' : path];
		}
	};
}
