import { EnhancedModel, EnhancedSchema } from '.';

export type Methods = {
	setOld: (path: string) => void;
	getOld: (path: string) => any;
	clearOld: (path: string) => void;
};

export default function pluginOld<TModel extends EnhancedModel>(schema: EnhancedSchema<TModel>) {
	schema.methods.setOld = function (path) {
		if (!this.$locals.old) {
			this.$locals.old = {};
		}

		if (this.$locals.old) {
			this.$locals.old[path] = this.get(path);
		}
	};

	schema.methods.getOld = function (path) {
		return this.$locals.old ? this.$locals.old[path] : null;
	};

	schema.methods.clearOld = function (path) {
		if (this.$locals.old) {
			delete this.$locals.old[path];
		}
	};
}
