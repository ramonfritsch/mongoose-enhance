import mongooseOriginal, {
	Document,
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

require('mongoose-strip-html-tags')(mongooseOriginal);
require('mongoose-shortid-nodeps');

type ExtraSchema<TModel extends AnyEnhancedModel> = {
	modelName: string;
} & PluginRelationshipSchema &
	PluginWhenSchema<TModel>;
type ExtraMethods = PluginOldMethods & PluginRestoreMethods & PluginWasModifiedMethods;
type ExtraStatics<TEntry extends AnyEnhancedEntry> = PluginEnsureEntryStatics<TEntry> &
	PluginPaginateStatics<TEntry>;

export type ExtractEntryType<TModel extends AnyEnhancedModel> = TModel extends EnhancedModel<
	infer TLeanEntry,
	infer TMethods,
	infer TStatics,
	infer TQueryHelpers
>
	? EnhancedEntry<TLeanEntry, TMethods, TQueryHelpers>
	: never;

type ExtractMethodsType<TModel extends AnyEnhancedModel> = TModel extends EnhancedModel<
	infer TLeanEntry,
	infer TMethods
>
	? TMethods
	: never;

export type EnhancedEntry<TLeanEntry = {}, TMethods = {}, TQueryHelpers = {}> = Document<
	ObjectId,
	TQueryHelpers,
	TLeanEntry
> &
	TLeanEntry &
	TMethods &
	ExtraMethods;
export type EnhancedModel<
	TLeanEntry = {},
	TMethods = {},
	TStatics = {},
	TQueryHelpers = {},
> = Model<
	EnhancedEntry<TLeanEntry, TMethods, TQueryHelpers>,
	TQueryHelpers,
	TMethods & ExtraMethods
> &
	TStatics &
	ExtraStatics<EnhancedEntry<TLeanEntry, TMethods, TQueryHelpers>>;
export type EnhancedSchema<TModel extends AnyEnhancedModel> = Schema<
	ExtractEntryType<TModel>,
	TModel,
	undefined,
	ExtractMethodsType<TModel> & ExtraMethods
> &
	ExtraSchema<TModel>;

type AnyEnhancedEntry = EnhancedEntry<any>;
type AnyEnhancedModel = EnhancedModel<any>;
type AnyEnhancedSchema = EnhancedSchema<AnyEnhancedModel>;

const compiledModelNames: string[] = [];
const schemaReadyCallbacks: Map<string, Array<(schema: any) => void>> = new Map();
const modelReadyCallbacks: Map<string, Array<(model: any) => void>> = new Map();

// External plugins
export type PluginDerivedMethods = ExternalPluginDerivedMethods;
function isString(value: any): value is string {
	return typeof value === 'string';
}

function isEnhancedSchema(value: any): value is AnyEnhancedSchema {
	return isString(value.modelName);
}

const originalModel = mongooseOriginal.model.bind(mongooseOriginal);

const createModel = <TModel extends AnyEnhancedModel>(
	name: string,
	schema: EnhancedSchema<TModel> | Schema,
): TModel => {
	// Run callbacks if schema is enhanced
	if (isEnhancedSchema(schema)) {
		if (name !== schema.modelName) {
			throw new Error('EnhancedSchema has a different `.modelName` than the model name');
		}

		const callbacks = schemaReadyCallbacks.get(name) || [];

		callbacks.forEach((callback) => callback(schema));

		schemaReadyCallbacks.delete(name);

		if (compiledModelNames.includes(name)) {
			throw new Error(
				`Trying to compile the same model twice (${name}). This usually happens when you use the derived plugin, create the models with the derived plugin before their foreign dependency.`,
			);
		}

		compiledModelNames.push(name);
	}

	const model = originalModel(name, schema as any) as TModel;

	const readyCallbacks = modelReadyCallbacks.get(name) || [];

	readyCallbacks.forEach((callback) => callback(model));

	modelReadyCallbacks.delete(name);

	return model;
};

function createSchema<TModel extends AnyEnhancedModel, TSchemaDefinitionType = undefined>(
	name: string,
	schemaDef: SchemaDefinition<LeanDocument<TSchemaDefinitionType>>,
	options?: SchemaOptions,
): EnhancedSchema<TModel> {
	const schema = new Schema<
		ExtractEntryType<TModel>,
		TModel,
		undefined,
		ExtractMethodsType<TModel> & ExtraMethods
	>(schemaDef, options) as EnhancedSchema<TModel>;

	schema.modelName = name;

	pluginEnsureEntry(schema);
	pluginOld(schema);
	pluginPaginate(schema);
	pluginRelationship(schema);
	pluginRestore(schema);
	pluginValidators(schema);
	pluginWasModified(schema);
	pluginWhen(schema);

	return schema;
}

function model<TModel extends AnyEnhancedModel>(
	nameOrSchema: string | EnhancedSchema<TModel>,
	schema?: EnhancedSchema<TModel> | Schema,
): TModel {
	if (isString(nameOrSchema)) {
		if (schema) {
			return createModel(nameOrSchema, schema);
		}

		return originalModel(nameOrSchema) as any;
	} else if (isEnhancedSchema(nameOrSchema)) {
		return createModel(nameOrSchema.modelName, nameOrSchema) as any;
	} else {
		throw new Error('Invalid arguments on mongoose.model');
	}
}

function onceSchemaIsReady<TSchema extends AnyEnhancedSchema>(
	name: string,
	callback: (schema: TSchema) => void,
) {
	if (compiledModelNames.includes(name)) {
		throw new Error(
			`Trying to register a pre compile hook when model ${name} is already compiled.`,
		);
	}

	const callbacks = schemaReadyCallbacks.get(name) || [];

	callbacks.push(callback);

	schemaReadyCallbacks.set(name, callbacks);
}

function onceModelIsReady<TModel extends AnyEnhancedModel>(
	name: string,
	callback: (model: TModel) => void,
) {
	if (compiledModelNames.includes(name)) {
		callback(model(name));
	} else {
		const callbacks = modelReadyCallbacks.get(name) || [];
		callbacks.push(callback);
		modelReadyCallbacks.set(name, callbacks);
	}
}

type MongooseEnhanced = Omit<typeof mongooseOriginal, 'model'> & {
	SchemaTypes: typeof mongooseOriginal.SchemaTypes & typeof extraTypes.ExtraSchemaTypes;
	Types: typeof mongooseOriginal.Types & typeof extraTypes.ExtraTypes;
	model: typeof model;
	enhance: {
		plugins: {
			derived: typeof externalPluginDerived;
		};
		onceSchemaIsReady: typeof onceSchemaIsReady;
		// TODO: Test this
		onceModelIsReady: typeof onceModelIsReady;
		sync: () => Promise<void>;
		syncRelationships: typeof syncRelationships;
		syncDerived: typeof syncDerived;
	};

	createSchema: typeof createSchema;
} & typeof helpers;

const mongoose = mongooseOriginal as MongooseEnhanced;

Object.entries(extraTypes.ExtraSchemaTypes).forEach(([name, type]) => {
	// @ts-ignore
	mongoose.SchemaTypes[name] = type;
	// @ts-ignore
	mongoose.Schema.Types[name] = type;
});

Object.entries(extraTypes.ExtraTypes).forEach(([name, type]) => {
	// @ts-ignore
	mongoose.Types[name] = type;
});

Object.entries(helpers).forEach(([name, fn]) => {
	// @ts-ignore
	mongoose[name] = fn;
});

mongoose.createSchema = createSchema;
mongoose.model = model;
mongoose.enhance = {
	plugins: {
		derived: externalPluginDerived,
	},
	onceSchemaIsReady,
	onceModelIsReady,
	async sync() {
		await syncRelationships();
		await syncDerived();
	},
	syncRelationships,
	syncDerived,
};

export default mongoose;

/*(async () => {
	type UserLeanEntry = {
		name: string;
		name2?: string;
	};

	type UserMethods = {
		age: number;
		testMethod: (name: string) => string;
	};

	type UserStatics = {
		testStatic: (name: string) => string;
	};

	type UserQueryHelpers = {};

	type UserModel = EnhancedModel<UserLeanEntry, UserMethods, UserStatics, UserQueryHelpers>;

	const userSchema = mongoose.createSchema<UserModel>('User', {
		name: { type: String, required: true },
		name2: String,
	});

	userSchema.virtual('age').get(function () {
		return 30;
	});

	userSchema.pre('save', function (next) {
		const _someOtherName = this.name + ' aep';

		next();
	});

	userSchema.methods.testMethod = function (name: string) {
		return this.name + ':' + name;
	};

	userSchema.statics.testStatic = function (name: string) {
		return 'Dale:' + name;
	};

	userSchema.whenNew(function () {
		const _someOtherName = this.name + ' aep';
	});

	const User = mongoose.model(userSchema);

	const user = await new User({
		name: 'John',
	});

	let a: any = user.name.length;
	a = user.name2;
	a = user.age;
	a = user.testMethod('Doe').length;
	a = User.testStatic('Jane').length;

	a = (await User.ensureEntry(user)).name;

	await user.save();
})();*/
