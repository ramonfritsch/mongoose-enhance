module.exports = mongoose => {
	mongoose.enhance.registerGlobalPlugin(schema => {
		schema.statics.ensureModel = function(model, query, callback) {
			if (!callback && typeof query === 'function') {
				callback = query;
				query = null;
			}

			if (
				!query &&
				typeof model === 'object' &&
				model.constructor &&
				model.constructor.name === 'model'
			) {
				return callback ? callback(null, model) : Promise.resolve(model);
			}

			return this.findOne(
				{
					_id: mongoose.id(model),
					...(query || {}),
				},
				callback,
			);
		};
	});
};
