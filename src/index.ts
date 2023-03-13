import mongooseOriginal, {
	Document,
	EnforceDocument,
	LeanDocument,
	Model,
	ObjectId,
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
type ExtractFieldsType<TModel extends EnhancedModel> = TModel extends EnhancedModel<infer TFields>
	? TFields
	: never;

// EnforceDocument<TFields, TMethods>,

export type EnhancedEntry<TFields = any, TMethods = any, TQueryHelpers = {}> = EnforceDocument<
	TFields,
	ExtraMethods & TMethods
>;

// export type EnhancedEntry<TFields = any, TMethods = any, TQueryHelpers = {}> = Document<
// 	ObjectId,
// 	TQueryHelpers,
// 	TFields
// > &
// 	ExtraMethods &
// 	TMethods;

export type EnhancedModel<TFields = {}, TMethods = {}, TStatics = {}, TQueryHelpers = {}> = Model<
	TFields,
	TQueryHelpers,
	ExtraMethods & TMethods
> &
	ExtraStatics<EnhancedEntry<TFields, TMethods, TQueryHelpers>> &
	TStatics;
export type EnhancedSchema<TModel extends EnhancedModel> = Schema<
	Document<ObjectId, undefined, ExtractFieldsType<TModel>>,
	TModel,
	undefined,
	ExtraMethods
> &
	ExtraSchema<TModel>;

type PreCompileCallback<TModel extends EnhancedModel = EnhancedModel> = (
	schema: EnhancedSchema<TModel>,
) => void;

const preCompileCallbacks: Map<string, Array<PreCompileCallback>> = new Map();

// External plugins
export type PluginDerivedMethods = ExternalPluginDerivedMethods;

function isString(value: any): value is string {
	return typeof value === 'string';
}

const mongooseEnhanced: {
	Schema: typeof Schema;
	SchemaTypes: typeof mongooseOriginal.SchemaTypes & typeof extraTypes.ExtraSchemaTypes;
	Types: typeof mongooseOriginal.Types & typeof extraTypes.ExtraTypes;
	connection: typeof mongooseOriginal.connection;
	connect: typeof mongooseOriginal.connect;
	disconnect: typeof mongooseOriginal.disconnect;
	model<TModel extends EnhancedModel>(nameOrSchema: string | EnhancedSchema<TModel>): TModel;
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
} & typeof helpers = {
	Schema,
	SchemaTypes: { ...mongooseOriginal.SchemaTypes, ...extraTypes.ExtraSchemaTypes },
	Types: { ...mongooseOriginal.Types, ...extraTypes.ExtraTypes },
	connection: mongooseOriginal.connection,
	connect: mongooseOriginal.connect.bind(mongooseOriginal),
	disconnect: mongooseOriginal.disconnect.bind(mongooseOriginal),
	model<TModel extends EnhancedModel>(nameOrSchema: string | EnhancedSchema<TModel>) {
		if (isString(nameOrSchema)) {
			return mongooseOriginal.model(nameOrSchema) as any;
		} else {
			const schema = nameOrSchema;
			const modelName = schema.modelName;

			const callbacks = preCompileCallbacks.get(modelName) || [];

			callbacks.forEach((callback) => callback(schema));

			return mongooseOriginal.model(modelName, schema as any);
		}
	},
	enhance: {
		plugins: {
			derived: externalPluginDerived,
		},
		_oncePreCompile(name, callback) {
			const callbacks = preCompileCallbacks.get(name) || [];

			callbacks.push(callback);

			preCompileCallbacks.set(name, callbacks);
		},
		// TODO: Remove onceSchemasAreReady from plugins
		// TODO: Do onceModelsAreReady on application code instead
		async sync() {
			await syncRelationships();
			await this.enhance.syncDerived();
		},
		syncRelationships,
		syncDerived,
	},
	createSchema<TModel extends EnhancedModel, TSchemaDefinitionType = undefined>(
		name: string,
		definition: SchemaDefinition<LeanDocument<TSchemaDefinitionType>>,
		options?: SchemaOptions,
	) {
		const schema = new Schema<
			Document<ObjectId, undefined, ExtractFieldsType<TModel>>,
			TModel,
			undefined,
			ExtraMethods
		>(definition, options);

		const enhancedSchema = schema as EnhancedSchema<TModel>;

		enhancedSchema.modelName = name;

		pluginEnsureEntry<TModel>(enhancedSchema);
		pluginOld<TModel>(enhancedSchema);
		pluginRestore<TModel>(enhancedSchema);
		pluginWasModified<TModel>(enhancedSchema);
		pluginRelationship<TModel>(enhancedSchema);
		pluginWhen<TModel>(enhancedSchema);
		pluginValidators<TModel>(enhancedSchema);
		pluginPaginate<TModel>(enhancedSchema);

		return enhancedSchema;
	},
	...helpers,
};

export default mongooseEnhanced;
