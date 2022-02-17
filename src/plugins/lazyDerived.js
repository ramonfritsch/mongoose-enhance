// it.only('should derive custom', async () => {
// 	const boardSchema = new mongoose.EnhancedSchema({
// 		name: String,
// 		thumbnail: String,
// 	});

// 	boardSchema.hasMany('Item', 'user');

// 	boardSchema.plugin(mongoose.enhance.plugins.derived, [
// 		{
// 			method: 'custom',
// 			localField: 'thumbnail',
// 			foreignModelName: 'BoardItem',
// 			foreignKey: 'board',
// 			query: async (entry) => {
// 				expect(entry).not.toBeNull();

// 				const aggregate = [
// 					{
// 						$match: {
// 							board: entry._id,
// 						},
// 					},
// 					{
// 						$project: {
// 							item: 1,
// 							order: 1,
// 							board: 1,
// 						},
// 					},
// 					{
// 						$lookup: {
// 							from: 'items',
// 							localField: 'item',
// 							foreignField: '_id',
// 							as: 'items',
// 						},
// 					},
// 					{
// 						$unwind: '$items',
// 					},
// 					{
// 						$match: {
// 							ignore: { $ne: true },
// 						},
// 					},
// 					{
// 						$sort: {
// 							order: -1,
// 						},
// 					},
// 					{
// 						$group: {
// 							_id: '$board',
// 							lastItem: { $first: '$items' },
// 						},
// 					},
// 				];

// 				const results = await mongoose.model('BoardItem').aggregate(aggregate).exec();

// 				if (results && results[0]) {
// 					if (results[0].lastItem) {
// 						return results[0].lastItem.thumbnail;
// 					}
// 				}

// 				return undefined;
// 			},
// 		},
// 	]);
