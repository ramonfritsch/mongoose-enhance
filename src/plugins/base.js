module.exports = (mongoose) => {
	let schemasReadyCallbacks = [];
	let modelsReadyCallbacks = [];
	let modelsToRegister = [];
	let globalPlugins = [];
	let canCreatSchemas = true;

	mongoose.enhance.registerGlobalPlugin = (plugin, options) => {
		globalPlugins.push({
			plugin,
			options,
		});
	};
	mongoose.enhance.schemas = {};

	mongoose.enhance.onceSchemasAreReady = (callback) => {
		schemasReadyCallbacks.push(callback);
	};

	mongoose.enhance.onceModelsAreReady = (callback) => {
		modelsReadyCallbacks.push(callback);
	};

	const originalModel = mongoose.model;
	mongoose.model = (modelName, schema, ...otherArgs) => {
		modelsToRegister.push({
			modelName,
			schema,
			otherArgs,
		});

		schema.modelName = modelName;

		mongoose.enhance.schemas[modelName] = schema;
	};

	mongoose.createModels = function () {
		canCreatSchemas = false;
		globalPlugins = [];

		schemasReadyCallbacks.map((callback) => callback());
		schemasReadyCallbacks = [];

		modelsToRegister.forEach(({ schema }) => schema.runPreCompileCallbacks());

		modelsToRegister.forEach(({ modelName, schema, otherArgs }) => {
			originalModel.apply(mongoose, [modelName, schema, ...otherArgs]);
		});
		modelsToRegister = [];

		modelsReadyCallbacks.map((callback) => callback());
		modelsReadyCallbacks = [];

		mongoose.model = originalModel.bind(mongoose);

		mongoose.createModels = function () {};
	};

	// Run relationship and derived rules on all database
	mongoose.enhance.sync = async function () {
		await mongoose.enhance.syncRelationships();
		await mongoose.enhance.syncDerived();
	};

	class EnhancedSchema extends mongoose.Schema {
		_preCompileCallbacks = [];

		constructor(...args) {
			super(...args);

			globalPlugins.forEach(({ plugin, options }) => plugin(this, options));

			if (!canCreatSchemas) {
				throw new Error('Cannot create EnhancedSchemas after models are created');
			}
		}

		oncePreCompile(callback) {
			this._preCompileCallbacks.push(callback);
		}

		runPreCompileCallbacks() {
			this._preCompileCallbacks.forEach((callback) => callback(this));
			this._preCompileCallbacks = [];
		}
	}

	mongoose.EnhancedSchema = EnhancedSchema;
};
