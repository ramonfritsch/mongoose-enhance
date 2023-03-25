import { AnyObject, Query } from 'mongoose';
import { EnhancedModel, EnhancedSchema } from '.';

// export type QueryHelpers = {

// };

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
		} else if (typeof value === 'object') {
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

export default function pluginMetrics<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	async function pre(this: Query<any, any>) {
		const options = this.getOptions();

		if (options.explain) {
			return;
		}

		(this as any)._metricsStartTime = performance.now();
	}

	function makePost(type: 'findOne' | 'find') {
		return async function (this: Query<any, any>) {
			const options = this.getOptions();

			if (options.explain) {
				return;
			}

			const duration = performance.now() - (this as any)._metricsStartTime;

			const optionsCopy = { ...options };
			const r = await this.findOne(this.getFilter(), this.projection(), {
				...options,
				explain: true,
			});

			const info = {
				type,
				duration,
				// name (from .setName)
				filters: filterSignature(this.getFilter()),
				options: optionsCopy,
				stages: stagesFromQueryPlan(r.queryPlanner.winningPlan),
				// isUsingIndex
			};

			console.log(info);
		};
	}

	schema.pre('findOne', pre);
	schema.pre('find', pre);
	schema.pre('aggregate', pre);

	schema.post('findOne', makePost('findOne'));
	schema.post('find', makePost('find'));
}
