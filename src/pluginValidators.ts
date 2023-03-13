import beautifyUnique from 'mongoose-beautiful-unique-validation';
import ucfirst from 'ucfirst';

import { EnhancedModel, EnhancedSchema } from '.';

export default function pluginValidators<TModel extends EnhancedModel>(
	schema: EnhancedSchema<TModel>,
) {
	// Convert `unique: true` index error messages into regular validation errors
	beautifyUnique(schema, {
		defaultMessage: '{LABEL} already exists.',
	});

	// Prettier `required: true` error messages
	Object.keys(schema.paths).forEach((key) => {
		const path = schema.paths[key];

		// @ts-ignore
		if (!path.options.label) {
			// @ts-ignore
			path.options.label = ucfirst(key);
		}

		// @ts-ignore
		path.validators.forEach((validator) => {
			// @ts-ignore
			validator.label = path.options.label;

			if (validator.type == 'required') {
				validator.message = '{LABEL} is required.';
			}
		});
	});
}
