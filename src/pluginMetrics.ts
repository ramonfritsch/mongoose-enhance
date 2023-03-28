import { Aggregate, AnyObject, FilterQuery, Query, QueryOptions } from 'mongoose';
import mongoose, { EnhancedModel, EnhancedSchema } from '.';

type Signature = {
	[key: string]: Signature | 1 | [Signature] | [Signature, '...'];
};

function filterSignature(fields: AnyObject | null): Signature {
	if (fields && typeof fields === 'object') {
		const result: Signature = {};

		Object.keys(fields).forEach((key) => {
			const value = fields[key];

			if (Array.isArray(value) && value.length > 0) {
				const signature = filterSignature(value[0]);

				result[key] = value.length > 1 ? [signature, '...'] : [signature];
			} else if (
				typeof value === 'object' &&
				value.constructor === Object &&
				!('_id' in value) &&
				!('id' in value) &&
				!('_bsontype' in value) &&
				!Array.isArray(value)
			) {
				result[key] = filterSignature(value);
			} else {
				result[key] = 1;
			}
		});

		return result;
	} else {
		return {};
	}
}

function stagesFromQueryPlan(plan: any, stack: string[] = []): string[] {
	stack.push(plan.stage);

	if (plan.inputStage) {
		return stagesFromQueryPlan(plan.inputStage, stack);
	}

	return stack.reverse();
}

function getOptions(query: Query<any, any> | Aggregate<any>): QueryOptions {
	if ('getOptions' in query) {
		return query.getOptions();
	} else if ('options' in query) {
		return (query as any).options;
	}

	return {};
}

function getQueryRunInfo(query: Query<any, any> | Aggregate<any>): null | {
	options: QueryOptions;
	duration: number;
} {
	const options = getOptions(query);

	if (options.explain) {
		return null;
	}

	const duration = performance.now() - (query as any)._metricsStartTime;

	if (duration < mongoose.enhance._internal.metrics.thresholdInMilliseconds) {
		return null;
	}

	if (
		mongoose.enhance._internal.metrics.currentSample %
			mongoose.enhance._internal.metrics.sampleRate !==
		0
	) {
		return null;
	}

	return {
		options,
		duration,
	};
}

async function pre(this: Query<any, any> | Aggregate<any>) {
	const options = getOptions(this);

	if (options.explain) {
		return;
	}

	mongoose.enhance._internal.metrics.currentSample++;

	(this as any)._metricsStartTime = performance.now();
}

function makePost(modelName: string, type: 'findOne' | 'find') {
	return async function (this: Query<any, any>) {
		const runInfo = getQueryRunInfo(this);

		if (!runInfo) {
			return;
		}

		const { options, duration } = runInfo;

		const filter = this.getFilter();

		const optionsCopy = { ...options };

		const findMethod =
			type === 'findOne'
				? this.model.findOne.bind(this.model)
				: this.model.find.bind(this.model);
		const r = await findMethod(filter, this.projection(), {
			...options,
			explain: true,
		}).exec();

		let filterSign = null;
		try {
			filterSign = filterSignature(filter);
		} catch (e) {}

		const executionStats = Array.isArray(r) ? r[0].executionStats : r.executionStats;

		const info: MetricsInfo = {
			modelName,
			type,
			duration,
			name: (this as any)._metricsName || null,
			source: (this as any)._metricsSource || null,
			filter,
			filterSignature: filterSign || {},
			options: optionsCopy,
			stages: stagesFromQueryPlan(executionStats.executionStages),
			count: executionStats.nReturned,
			internalDuration: executionStats.executionTimeMillis,
			keysExamined: executionStats.totalKeysExamined,
			docsExamined: executionStats.totalDocsExamined,
		};

		// Place on a set immediate so this can carry on executing
		setImmediate(() => {
			mongoose.enhance._internal.metrics.callback(info);
		});
	};
}

function name<TQuery>(this: TQuery, name: string): TQuery {
	(this as any)._metricsName = name;

	return this;
}

function source<TQuery>(this: TQuery, source: string): TQuery {
	// Remove cwd from source
	const cwd = process.cwd();
	if (source.startsWith(cwd)) {
		source = source.slice(cwd.length);
	}

	(this as any)._metricsSource = source;

	return this;
}

export type MetricsInfo = {
	modelName: string;
	type: 'findOne' | 'find' | 'aggregate';
	duration: number;
	name: string | null;
	source: string | null;
	filter: FilterQuery<any>;
	filterSignature: Signature;
	options: QueryOptions;
	stages: string[];
	count: number;
	internalDuration: number;
	keysExamined: number;
	docsExamined: number;
};

export type QueryHelpers = {
	name: typeof name;
	source: typeof source;
};

// declare module mongoose {
// 	interface Aggregate {
// 		name: typeof name;
// 		source: typeof source;
// 	}
// }

export default function pluginMetrics<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.query.name = name;
	schema.query.source = source;

	if (mongoose.enhance._internal.metrics.enabled) {
		schema.pre('findOne', pre);
		schema.pre('find', pre);
		schema.pre('aggregate', pre);

		schema.post('findOne', makePost(schema.modelName, 'findOne'));
		schema.post('find', makePost(schema.modelName, 'find'));

		schema.post('aggregate', async function (this: Aggregate<any>) {
			const runInfo = getQueryRunInfo(this);

			if (!runInfo) {
				return;
			}

			const { options, duration } = runInfo;

			const model = mongoose.model(schema.modelName);

			const optionsCopy = { ...options };
			const pipeline = this.pipeline();

			const r = await model
				.aggregate(pipeline)
				.option({
					...options,
					explain: true,
				})
				.exec();

			let filterSign = null;
			try {
				filterSign = filterSignature(pipeline);
			} catch (e) {}

			let executionStats: AnyObject = {};
			try {
				executionStats = r[0].stages[0].$cursor.executionStats;
			} catch (e) {}
			executionStats = executionStats || {};

			const info: MetricsInfo = {
				modelName: schema.modelName,
				type: 'aggregate',
				duration,
				name: null,
				source: null,
				// name: (this as any)._metricsName || null,
				// source: (this as any)._metricsSource || null,
				filter: pipeline,
				filterSignature: filterSign || {},
				options: optionsCopy,
				stages: executionStats.executionStages
					? stagesFromQueryPlan(executionStats.executionStages)
					: [],
				count: executionStats.nReturned || 0,
				internalDuration: executionStats.executionTimeMillis || 0,
				keysExamined: executionStats.totalKeysExamined || 0,
				docsExamined: executionStats.totalDocsExamined || 0,
			};

			// Place on a set immediate so this can carry on executing
			setImmediate(() => {
				mongoose.enhance._internal.metrics.callback(info);
			});
		});
		// TODO: Aggregations name and source
	}
}
