import { AnyObject, FilterQuery, Query, QueryOptions } from 'mongoose';
import mongoose, { EnhancedModel, EnhancedSchema } from '.';

type Signature = {
	[key: string]: Signature | 1 | [Signature] | [Signature, '...'];
};

function filterSignature(fields: AnyObject): Signature {
	const result: Signature = {};

	Object.keys(fields).forEach((key) => {
		const value = fields[key];

		if (Array.isArray(value) && value.length > 0) {
			const signature = filterSignature(value[0]);

			result[key] = value.length > 1 ? [signature, '...'] : [signature];
		} else if (
			typeof value === 'object' &&
			value.constructor === Object &&
			!mongoose.isValidObjectId(value)
		) {
			result[key] = filterSignature(value);
		} else {
			result[key] = 1;
		}
	});

	return result;
}

function stagesFromQueryPlan(plan: any, stack: string[] = []): string[] {
	stack.push(plan.stage);

	if (plan.inputStage) {
		return stagesFromQueryPlan(plan.inputStage, stack);
	}

	return stack.reverse();
}

async function pre(this: Query<any, any>) {
	const options = this.getOptions();

	if (options.explain) {
		return;
	}

	mongoose.enhance._internal.metrics.currentSample++;

	(this as any)._metricsStartTime = performance.now();
}

function makePost(modelName: string, type: 'findOne' | 'find') {
	return async function (this: Query<any, any>) {
		const options = this.getOptions();

		if (options.explain) {
			return;
		}

		const duration = performance.now() - (this as any)._metricsStartTime;

		if (duration < mongoose.enhance._internal.metrics.thresholdInMilliseconds) {
			return;
		}

		if (
			mongoose.enhance._internal.metrics.currentSample %
				mongoose.enhance._internal.metrics.sampleRate !==
			0
		) {
			return;
		}

		const filter = this.getFilter();

		const optionsCopy = { ...options };
		const r = await this.findOne(filter, this.projection(), {
			...options,
			explain: true,
		});

		const info: MetricsInfo = {
			modelName,
			type,
			duration,
			name: (this as any)._metricsName || null,
			source: (this as any)._metricsSource || null,
			filter,
			filterSignature: filterSignature(filter),
			options: optionsCopy,
			stages: stagesFromQueryPlan(r.queryPlanner.winningPlan),
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
	type: 'findOne' | 'find';
	duration: number;
	name: string | null;
	source: string | null;
	filter: FilterQuery<any>;
	filterSignature: Signature;
	options: QueryOptions;
	stages: string[];
};

export type QueryHelpers = {
	name: typeof name;
	source: typeof source;
};

export default function pluginMetrics<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.query.name = name;
	schema.query.source = source;

	if (mongoose.enhance._internal.metrics.enabled) {
		schema.pre('findOne', pre);
		schema.pre('find', pre);

		schema.post('findOne', makePost(schema.modelName, 'findOne'));
		schema.post('find', makePost(schema.modelName, 'find'));

		// TODO: Aggregations
	}
}
