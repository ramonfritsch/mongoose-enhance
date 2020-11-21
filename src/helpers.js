const _ = require('lodash');
const pLimit = require('p-limit');

const helpers = {
	id: (entry) => (entry && typeof entry == 'object' && entry._id ? entry._id : entry),
	equals: (id1, id2) => String(helpers.id(id1)) == String(helpers.id(id2)),
	ciQuery: (value, loose) =>
		new RegExp(
			(loose ? '' : '^') + _.escapeRegExp((value || '').toLowerCase()) + (loose ? '' : '$'),
			'i',
		),
	cursorEachAsyncLimit: async (concurrentLimit, cursor, eachCallback) => {
		const limit = pLimit(concurrentLimit);

		await cursor.eachAsync((entry) => {
			limit((entry) => eachCallback(entry), entry);
		});

		while (limit.pendingCount + limit.activeCount) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	},
};

module.exports = helpers;
