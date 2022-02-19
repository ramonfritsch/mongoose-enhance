const testMemoryServer = require('../__tests_utils__/testMemoryServer');

jest.setTimeout(30000);

let mongoose;

describe('derived', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();

		mongoose.set('debug', true);
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it.only('should derive count', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsCount: Number,
		});

		userSchema.hasMany('Item', 'user');

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'count',
				localField: 'itemsCount',
				foreignModelName: 'Item',
				foreignKey: 'user',
				query: (entry) => {
					expect(entry).not.toBeNull();

					return {
						ignore: { $ne: true },
					};
				},
			},
		]);

		mongoose.model('User', userSchema);

		const itemSchema = new mongoose.EnhancedSchema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			createdAt: Date,
			ignore: Boolean,
		});

		itemSchema.hasMany('SubItem', 'item');

		mongoose.model('Item', itemSchema);

		const subItemSchema = new mongoose.EnhancedSchema({
			item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
		});

		mongoose.model('SubItem', subItemSchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');
		const SubItem = mongoose.model('SubItem');

		let user = await new User({
			name: 'User Name',
		}).save();

		expect(user.itemsCount).toBe(0);

		const item1 = await new Item({
			user: user._id,
			createdAt: new Date(),
		}).save();

		await user.restore();

		expect(user.itemsCount).toBe(1);

		// let user2 = await new User({
		// 	name: 'User Name 2',
		// }).save();

		// const item2 = await new Item({
		// 	user: user2._id,
		// 	createdAt: new Date(),
		// }).save();

		// await new Item({
		// 	user: user2._id,
		// 	createdAt: new Date(),
		// }).save();

		// await new Item({
		// 	user: user2._id,
		// 	createdAt: new Date(),
		// 	ignore: true,
		// }).save();

		// await user.restore();
		// await user2.restore();

		// expect(user.itemsCount).toBe(1);
		// expect(user2.itemsCount).toBe(2);

		// await item1.remove();

		// await user.restore();
		// await user2.restore();

		// expect(user.itemsCount).toBe(0);
		// expect(user2.itemsCount).toBe(2);

		// await new SubItem({
		// 	item: item2._id,
		// }).save();

		// let subItemsCount = await SubItem.countDocuments({});
		// expect(subItemsCount).toBe(1);

		// await item2.remove();

		// await user.restore();
		// await user2.restore();

		// expect(user.itemsCount).toBe(0);
		// expect(user2.itemsCount).toBe(1);

		// subItemsCount = await SubItem.countDocuments({});
		// expect(subItemsCount).toBe(0);
	});

	it('should derive sum', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsViews: Number,
		});

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'sum',
				localField: 'itemsViews',
				foreignModelName: 'Item',
				foreignKey: 'user',
				foreignSumKey: 'views',
			},
		]);

		mongoose.model('User', userSchema);

		const itemSchema = new mongoose.EnhancedSchema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		mongoose.model('Item', itemSchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');

		let user = await new User({
			name: 'User Name',
		}).save();

		expect(user.itemsViews).toBe(0);

		const item1 = await new Item({
			user: user._id,
			views: 5,
		}).save();

		await user.restore();

		expect(user.itemsViews).toBe(5);

		let user2 = await new User({
			name: 'User Name 2',
		}).save();

		const item2 = await new Item({
			user: user2._id,
			views: 7,
		}).save();

		await new Item({
			user: user2._id,
			views: 10,
		}).save();

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(17);

		await item1.remove();

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(17);

		await item2.remove();

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(10);
	});

	it('should derive custom', async () => {
		const boardSchema = new mongoose.EnhancedSchema({
			name: String,
			thumbnail: String,
		});

		boardSchema.hasMany('Item', 'user');

		boardSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'custom',
				localField: 'thumbnail',
				foreignModelName: 'BoardItem',
				foreignKey: 'board',
				query: async (entry) => {
					expect(entry).not.toBeNull();

					const boardItems = await mongoose
						.model('BoardItem')
						.find({
							board: entry._id,
							ignore: { $ne: true },
						})
						.sort('-order')
						.limit(1)
						.exec();

					if (boardItems && boardItems[0]) {
						return boardItems[0].thumbnail;
					}

					return null;
				},
			},
		]);

		boardSchema.hasMany('BoardItem', 'board');

		mongoose.model('Board', boardSchema);

		const boardItemSchema = new mongoose.EnhancedSchema({
			board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
			order: Number,
			thumbnail: String,
			ignore: Boolean,
		});

		mongoose.model('BoardItem', boardItemSchema);

		mongoose.createModels();

		const Board = mongoose.model('Board');
		const BoardItem = mongoose.model('BoardItem');

		const board = await new Board({
			name: 'Board Name',
		}).save();

		await board.restore();

		expect(board.thumbnail).toBe(null);

		const boardItem1 = await new BoardItem({
			board: board._id,
			order: 1,
			thumbnail: 'thumbnail1.jpg',
		}).save();

		await board.restore();

		expect(board.thumbnail).toBe(boardItem1.thumbnail);

		const board2 = await new Board({
			name: 'User Name 2',
		}).save();

		await board2.restore();

		expect(board2.thumbnail).toBe(null);

		const boardItem2 = await new BoardItem({
			board: board2._id,
			order: 1,
			thumbnail: 'thumbnail2.jpg',
		}).save();

		await board.restore();
		await board2.restore();

		expect(board.thumbnail).toBe(boardItem1.thumbnail);
		expect(board2.thumbnail).toBe(boardItem2.thumbnail);

		const boardItem3 = await new BoardItem({
			board: board2._id,
			order: 2,
			thumbnail: 'thumbnail3.jpg',
		}).save();

		await board.restore();
		await board2.restore();

		expect(board.thumbnail).toBe(boardItem1.thumbnail);
		expect(board2.thumbnail).toBe(boardItem3.thumbnail);

		await boardItem1.remove();

		await board.restore();
		await board2.restore();

		expect(board.thumbnail).toBe(null);
		expect(board2.thumbnail).toBe(boardItem3.thumbnail);

		await boardItem3.remove();

		await board.restore();
		await board2.restore();

		expect(board.thumbnail).toBe(null);
		expect(board2.thumbnail).toBe(boardItem2.thumbnail);
	});

	it('should sync derived fields', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsViews: { type: Number, default: 0 },
		});

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'sum',
				localField: 'itemsViews',
				foreignModelName: 'Item',
				foreignKey: 'user',
				foreignSumKey: 'views',
			},
		]);

		mongoose.model('User', userSchema);

		const itemSchema = new mongoose.EnhancedSchema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		mongoose.model('Item', itemSchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');

		let user = await new User({
			name: 'User Name',
		}).save();

		let user2 = await new User({
			name: 'User Name 2',
		}).save();

		const db = mongoose.connection.client.db();

		await db.collection('items').insertMany([
			{
				user: user._id,
				views: 2,
			},
			{
				user: user._id,
				views: 3,
			},
			{
				user: user2._id,
				views: 10,
			},
		]);

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(0);

		await mongoose.enhance.syncDerived();

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(10);

		await new Item({
			user: user2._id,
			views: 12,
		}).save();

		await user.restore();
		await user2.restore();

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(22);
	});
});
