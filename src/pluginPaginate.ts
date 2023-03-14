import { EnhancedEntry, EnhancedModel, EnhancedSchema, ExtractEntryType } from '.';

export type Result<TEntry extends EnhancedEntry<any>> = {
	total: number;
	entries: Array<TEntry>;
	currentPage: number;
	totalPages: number;
	pages: Array<{ page: number; label: string; isCurrent?: boolean }>;
	previousPage: number | boolean;
	nextPage: number | boolean;
	firstPage: number | boolean;
	lastPage: number | boolean;
	first: number;
	last: number;
};

export type Statics<TEntry extends EnhancedEntry<any>> = {
	paginate: (
		options: {
			filters?: any;
			optionalExpression?: any;
			page?: number;
			pageSize?: number;
			maxPages?: number;
			select?: any;
			sort?: any;
		},
		callback?: (err: Error | undefined, result?: Result<TEntry>) => void,
	) => {
		exec: (callback: (err: Error | undefined, result?: Result<TEntry>) => void) => void;
	};
};

export default function pluginPaginate<TModel extends EnhancedModel<any>>(
	schema: EnhancedSchema<TModel>,
) {
	schema.statics.paginate = function (
		options: {
			filters?: any;
			optionalExpression?: any;
			page?: number;
			pageSize?: number;
			maxPages?: number;
			select?: any;
			sort?: any;
		},
		callback:
			| ((err: any, result?: Result<ExtractEntryType<TModel>>) => void)
			| undefined = undefined,
	): {
		exec: (callback: (err: any, result?: Result<ExtractEntryType<TModel>>) => void) => void;
	} {
		options = options || {};

		const query = this.find(options.filters, options.optionalExpression);
		const countQuery = this.find(options.filters);

		const originalExec = query.exec.bind(query);
		const originalSort = query.sort.bind(query);
		const originalSelect = query.select.bind(query);

		const currentPage = parseInt(String(options.page)) || 1;
		const pageSize = parseInt(String(options.pageSize)) || 50;
		const maxPages = parseInt(String(options.maxPages)) || 10;
		const skip = (currentPage - 1) * pageSize;

		query.select = function () {
			options.select = arguments[0];
			return query;
		};

		query.sort = function () {
			options.sort = arguments[0];
			return query;
		};

		// @ts-ignore
		query.exec = async function (
			callback: (err: any, result?: Result<ExtractEntryType<TModel>>) => void,
		) {
			try {
				query.limit(pageSize).skip(skip);

				if (options.select) {
					originalSelect(options.select);
				}

				if (options.sort) {
					originalSort(options.sort);
				}

				const [count, entries] = await Promise.all([
					options.filters &&
					typeof options.filters === 'object' &&
					Object.keys(options.filters).length > 0
						? countQuery.countDocuments()
						: countQuery.estimatedDocumentCount(),
					originalExec(),
				]);

				const totalPages = Math.ceil(count / pageSize);
				const data: Result<ExtractEntryType<TModel>> = {
					total: count,
					entries,
					currentPage,
					totalPages,
					pages: [],
					previousPage: currentPage > 1 ? currentPage - 1 : false,
					nextPage: currentPage < totalPages ? currentPage + 1 : false,
					firstPage: currentPage > 1 ? 1 : false,
					lastPage: currentPage < totalPages ? totalPages : false,
					first: skip + 1,
					last: skip + entries.length,
				};

				const surround = Math.floor(maxPages / 2);
				let firstPage = maxPages ? Math.max(1, data.currentPage - surround) : 1;
				const padRight = Math.max((data.currentPage - surround - 1) * -1, 0);
				const lastPage = maxPages
					? Math.min(data.totalPages, data.currentPage + surround + padRight)
					: data.totalPages;
				const padLeft = Math.max(data.currentPage + surround - lastPage, 0);
				firstPage = Math.max(Math.min(firstPage, firstPage - padLeft), 1);
				for (let i = firstPage; i <= lastPage; i++) {
					data.pages.push({
						isCurrent: data.currentPage == i,
						page: i,
						label: String(i),
					});
				}
				if (firstPage !== 1) {
					data.pages.shift();
					data.pages.unshift({
						page: firstPage,
						label: '...',
					});
				}
				if (lastPage !== Number(data.totalPages)) {
					data.pages.pop();
					data.pages.push({
						page: lastPage,
						label: '...',
					});
				}

				callback(null, data);
			} catch (error) {
				callback(error);
			}
		};

		if (callback) {
			// @ts-ignore
			return query.exec(callback);
		}

		return query;
	};
}
