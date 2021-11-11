module.exports = mongoose => {
	function fillPages(data, maxPages) {
		var surround = Math.floor(maxPages / 2);
		var firstPage = maxPages ? Math.max(1, data.currentPage - surround) : 1;
		var padRight = Math.max((data.currentPage - surround - 1) * -1, 0);
		var lastPage = maxPages
			? Math.min(data.totalPages, data.currentPage + surround + padRight)
			: data.totalPages;
		var padLeft = Math.max(data.currentPage + surround - lastPage, 0);
		data.pages = [];
		firstPage = Math.max(Math.min(firstPage, firstPage - padLeft), 1);
		for (var i = firstPage; i <= lastPage; i++) {
			data.pages.push({
				isCurrent: data.currentPage == i,
				page: i,
				label: i,
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
	}

	mongoose.enhance.registerGlobalPlugin(schema => {
		schema.statics.paginate = function(options, callback) {
			options = options || {};

			const query = this.find(options.filters, options.optionalExpression);
			const countQuery = this.find(options.filters);

			query._originalExec = query.exec;
			query._originalSort = query.sort;
			query._originalSelect = query.select;

			const currentPage = parseInt(options.page) || 1;
			const pageSize = parseInt(options.pageSize) || 50;
			const maxPages = parseInt(options.maxPages) || 10;
			const skip = (currentPage - 1) * pageSize;

			query.select = function() {
				options.select = arguments[0];
				return query;
			};

			query.sort = function() {
				options.sort = arguments[0];
				return query;
			};

			query.exec = async function(callback) {
				try {
					query.limit(pageSize).skip(skip);

					if (options.select) {
						query._originalSelect(options.select);
					}

					if (options.sort) {
						query._originalSort(options.sort);
					}

					const [count, entries] = await Promise.all([
						countQuery.countDocuments(),
						query._originalExec(),
					]);

					const totalPages = Math.ceil(count / pageSize);
					const data = {
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
					fillPages(data, maxPages);

					callback(null, data);
				} catch (error) {
					callback(error);
				}
			};

			if (callback) {
				return query(callback);
			}

			return query;
		};
	});
};
