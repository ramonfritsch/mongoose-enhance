module.exports = (mongoose) => {
	let schemasReadyCallbacks = [];
	let modelsReadyCallbacks = [];
	let modelsToRegister = [];
	let globalPlugins = [];

	mongoose.enhance.registerGlobalPlugin = (plugin, options) => {
		if (!globalPlugins) {
			throw new Error("Can't register global plugins after models are created");
		}

		globalPlugins.push({
			plugin,
			options,
		});
	};
	mongoose.enhance.schemas = {};

	mongoose.enhance.onceSchemasAreReady = (callback) => {
		if (schemasReadyCallbacks) {
			schemasReadyCallbacks.push(callback);
		} else {
			callback();
		}
	};

	mongoose.enhance.onceModelsAreReady = (callback) => {
		if (modelsReadyCallbacks) {
			modelsReadyCallbacks.push(callback);
		} else {
			callback();
		}
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
		globalPlugins = null;

		schemasReadyCallbacks.map((callback) => callback());
		schemasReadyCallbacks = null;

		modelsToRegister.forEach(({ schema }) => schema.runPreCompileCallbacks());

		modelsToRegister.forEach(({ modelName, schema, otherArgs }) => {
			originalModel.apply(mongoose, [modelName, schema, ...otherArgs]);
		});
		modelsToRegister = null;

		mongoose.model = originalModel.bind(mongoose);

		modelsReadyCallbacks.map((callback) => callback());
		modelsReadyCallbacks = null;

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

			if (!globalPlugins) {
				throw new Error('Cannot create EnhancedSchemas after models are created');
			}

			globalPlugins.forEach(({ plugin, options }) => plugin(this, options));
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
