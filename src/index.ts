import mongooseOriginal, {
	EnforceDocument,
	LeanDocument,
	Model,
	Schema,
	SchemaDefinition,
	SchemaOptions,
} from 'mongoose';
import externalPluginDerived, {
	Methods as ExternalPluginDerivedMethods,
	syncDerived,
} from './externalPluginDerived';
import extraTypes from './extraTypes';
import helpers from './helpers';
import pluginEnsureEntry, { Statics as PluginEnsureEntryStatics } from './pluginEnsureEntry';
import pluginOld, { Methods as PluginOldMethods } from './pluginOld';
import pluginPaginate, { Statics as PluginPaginateStatics } from './pluginPaginate';
import pluginRelationship, {
	Schema as PluginRelationshipSchema,
	syncRelationships,
} from './pluginRelationship';
import pluginRestore, { Methods as PluginRestoreMethods } from './pluginRestore';
import pluginValidators from './pluginValidators';
import pluginWasModified, { Methods as PluginWasModifiedMethods } from './pluginWasModified';
import pluginWhen, { Schema as PluginWhenSchema } from './pluginWhen';

if (global.Promise) {
	mongooseOriginal.Promise = global.Promise;
}

export * from 'mongoose';

require('mongoose-strip-html-tags')(mongooseOriginal);
require('mongoose-shortid-nodeps');

type ExtraSchema<TModel extends EnhancedModel> = {
	modelName: string;
} & PluginRelationshipSchema &
	PluginWhenSchema<TModel>;
type ExtraMethods = PluginOldMethods & PluginWasModifiedMethods & PluginRestoreMethods;
type ExtraStatics<TEntry extends EnhancedEntry> = PluginEnsureEntryStatics<TEntry> &
	PluginPaginateStatics<TEntry>;

export type ExtractEntryType<TModel extends EnhancedModel> = TModel extends EnhancedModel<
	infer TFields,
	infer TMethods
>
	? EnhancedEntry<TFields, TMethods>
	: never;

type ExtractPartialEntryType<TModel extends EnhancedModel> = TModel extends EnhancedModel<
	infer TFields,
	infer TMethods
>
	? EnhancedEntry<Partial<TFields>, TMethods>
	: never;

export type EnhancedEntry<TFields = any, TMethods = any, TQueryHelpers = {}> = EnforceDocument<
	TFields,
	ExtraMethods & TMethods
>;

export type EnhancedModel<TFields = {}, TMethods = {}, TStatics = {}, TQueryHelpers = {}> = Model<
	Partial<TFields>,
	TQueryHelpers,
	ExtraMethods & TMethods
> &
	ExtraStatics<EnhancedEntry<Partial<TFields>, TMethods, TQueryHelpers>> &
	TStatics;
export type EnhancedSchema<TModel extends EnhancedModel> = Schema<
	ExtractPartialEntryType<TModel>,
	TModel,
	undefined,
	ExtraMethods
> &
	ExtraSchema<TModel>;

type PreCompileCallback<TModel extends EnhancedModel = EnhancedModel> = (
	schema: EnhancedSchema<TModel>,
) => void;

const compiledModelNames: string[] = [];
const preCompileCallbacks: Map<string, Array<PreCompileCallback>> = new Map();

// External plugins
export type PluginDerivedMethods = ExternalPluginDerivedMethods;

function isString(value: any): value is string {
	return typeof value === 'string';
}

function isEnhancedSchema(value: any): value is EnhancedSchema<any> {
	return isString(value.modelName);
}

const originalModel = mongooseOriginal.model;
const createModel = <TModel extends EnhancedModel>(
	name: string,
	schema: EnhancedSchema<TModel> | Schema,
): TModel => {
	// Run callbacks if schema is enhanced
	if (isEnhancedSchema(schema)) {
		if (name !== schema.modelName) {
			throw new Error('EnhancedSchema has a different `.modelName` than the model name');
		}

		const callbacks = preCompileCallbacks.get(name) || [];

		callbacks.forEach((callback) => callback(schema));

		if (compiledModelNames.includes(name)) {
			throw new Error(
				`Trying to compile the same model twice (${name}). This usually happens when you use the derived plugin, create the models with the derived plugin before their foreign dependency.`,
			);
		}

		compiledModelNames[name] = true;
	}

	return originalModel(name, schema as any) as any;
};

type MongooseEnhanced = Omit<typeof mongooseOriginal, 'model'> & {
	original: typeof mongooseOriginal;
	SchemaTypes: typeof mongooseOriginal.SchemaTypes & typeof extraTypes.ExtraSchemaTypes;
	Types: typeof mongooseOriginal.Types & typeof extraTypes.ExtraTypes;
	model<TModel extends EnhancedModel>(
		nameOrSchema: string | EnhancedSchema<TModel>,
		schema?: EnhancedSchema<TModel> | Schema,
	): TModel;
	enhance: {
		plugins: Record<string, typeof externalPluginDerived>;
		_oncePreCompile<TModel extends EnhancedModel>(
			name: string,
			callback: PreCompileCallback<TModel>,
		): void;
		sync: () => Promise<void>;
		syncRelationships: typeof syncRelationships;
		syncDerived: typeof syncDerived;
	};

	createSchema<TModel extends EnhancedModel, TSchemaDefinitionType = undefined>(
		name: string,
		definition: SchemaDefinition<LeanDocument<TSchemaDefinitionType>>,
		options?: SchemaOptions,
	): EnhancedSchema<TModel>;
} & typeof helpers;

const mongooseEnhanced = mongooseOriginal as MongooseEnhanced;

mongooseEnhanced.original = mongooseOriginal;

Object.entries(extraTypes.ExtraSchemaTypes).forEach(([name, type]) => {
	mongooseEnhanced.SchemaTypes[name] = type;
	mongooseEnhanced.Schema.Types[name] = type;
});

Object.entries(extraTypes.ExtraTypes).forEach(([name, type]) => {
	mongooseEnhanced.Types[name] = type;
});

Object.entries(helpers).forEach(([name, fn]) => {
	mongooseEnhanced[name] = fn;
});

mongooseEnhanced.model = <TModel extends EnhancedModel>(
	nameOrSchema: string | EnhancedSchema<TModel>,
	schema?: EnhancedSchema<TModel> | Schema,
) => {
	if (isString(nameOrSchema)) {
		if (schema) {
			return createModel(nameOrSchema, schema);
		}

		return originalModel(nameOrSchema) as any;
	} else if (isEnhancedSchema(nameOrSchema)) {
		return createModel(nameOrSchema.modelName, nameOrSchema);
	} else {
		throw new Error('Invalid arguments on mongoose.model');
	}
};

mongooseEnhanced.enhance = {
	plugins: {
		derived: externalPluginDerived,
	},
	_oncePreCompile(name, callback) {
		if (compiledModelNames.includes(name)) {
			throw new Error(
				`Trying to register a pre compile hook when model ${name} is already compiled.`,
			);
		}

		const callbacks = preCompileCallbacks.get(name) || [];

		callbacks.push(callback);

		preCompileCallbacks.set(name, callbacks);
	},
	async sync() {
		await syncRelationships();
		await this.enhance.syncDerived();
	},
	syncRelationships,
	syncDerived,
};

mongooseEnhanced.createSchema = <TModel extends EnhancedModel, TSchemaDefinitionType = undefined>(
	name: string,
	definition: SchemaDefinition<LeanDocument<TSchemaDefinitionType>>,
	options?: SchemaOptions,
) => {
	const schema = new Schema<
		ExtractPartialEntryType<TModel>,
		TModel,
		TSchemaDefinitionType,
		ExtraMethods
	>(definition, options);

	const enhancedSchema = schema as EnhancedSchema<TModel>;

	enhancedSchema.modelName = name;

	pluginEnsureEntry(enhancedSchema);
	pluginOld(enhancedSchema);
	pluginRestore(enhancedSchema);
	pluginWasModified(enhancedSchema);
	pluginRelationship(enhancedSchema);
	pluginWhen(enhancedSchema);
	pluginValidators(enhancedSchema);
	pluginPaginate(enhancedSchema);

	return enhancedSchema;
};

export default mongooseEnhanced;
