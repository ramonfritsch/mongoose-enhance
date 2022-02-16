const ucfirst = require('ucfirst');
const uniqueValidator = require('mongoose-unique-validator');

module.exports = (mongoose) => {
	// TODO: perf: Only run unique validator on changed paths, not on every save
	mongoose.enhance.registerGlobalPlugin(uniqueValidator, {
		message: '{LABEL} aready exists.',
	});

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
