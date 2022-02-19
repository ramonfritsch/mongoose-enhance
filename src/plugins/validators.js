const ucfirst = require('ucfirst');
const beautifyUnique = require('mongoose-beautiful-unique-validation');

module.exports = (mongoose) => {
	// TODO: perf: Do our own unique validator, 'mongoose-unique-validator' is not performant, runs too many queries...
	// TODO: perf: Only run unique validator on changed paths, not on every save
	// TODO: perf: Only check when field has a `unique` option in schema, not for _ids 🤌
	// mongoose.enhance.registerGlobalPlugin(uniqueValidator, {
	// 	message: '{LABEL} aready exists.',
	// });

	// Convert `unique: true` index error messages into regular validation errors
	mongoose.enhance.registerGlobalPlugin(beautifyUnique, {
		defaultMessage: '{LABEL} aready exists.',
	});

	// Prettier `required: true` error messages
	mongoose.enhance.registerGlobalPlugin((schema) => {
		Object.keys(schema.paths).forEach((key) => {
			const path = schema.paths[key];

			if (!path.options.label) {
				path.options.label = ucfirst(key);
			}

			path.validators.forEach((validator) => {
				validator.label = path.options.label;

				if (validator.type == 'required') {
					validator.message = '{LABEL} is required.';
				}
			});
		});
	});
};
