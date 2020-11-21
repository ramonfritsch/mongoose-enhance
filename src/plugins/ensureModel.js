module.exports = (mongoose) => {
	mongoose.enhance.registerPlugin((schema) => {
		schema.statics.ensureModel = function (model, callback) {
			if (
				typeof model === 'object' &&
				model.constructor &&
				model.constructor.name === 'model'
			) {
				return callback ? callback(null, model) : Promise.resolve(model);
			}

			return this.findOne(
				{
					_id: mongoose.id(model),
				},
				callback,
			);
		};
	});
};
