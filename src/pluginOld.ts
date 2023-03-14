import { EnhancedModel, EnhancedSchema } from '.';

export type Methods = {
	setOld: (path: string) => void;
	getOld: (path: string) => any;
	clearOld: (path: string) => void;
};

function isObject(value: any): value is Record<string, any> {
	return value && typeof value === 'object';
}

export default function pluginOld<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.methods.setOld = function (path: string) {
		if (!this.$locals.old) {
			this.$locals.old = {};
		}

		if (isObject(this.$locals.old)) {
			this.$locals.old[path] = this.get(path);
		}
	};

	schema.methods.getOld = function (path: string): any {
		return isObject(this.$locals.old) ? this.$locals.old[path] : null;
	};

	schema.methods.clearOld = function (path: string) {
		if (isObject(this.$locals.old)) {
			delete this.$locals.old[path];
		}
	};
}
