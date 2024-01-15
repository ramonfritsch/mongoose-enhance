import { EnhancedModel, EnhancedSchema, ExtractEntryType, Types } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('derived', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();

		// mongoose.set('debug', true);
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should derive count', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
			itemsCount?: number;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			itemsCount: Number,
		});

		userSchema.hasMany('Item', 'user');

		mongoose.enhance.plugins.derived(userSchema, [
			{
				method: 'count',
				localField: 'itemsCount',
				foreignModelName: 'Item',
				foreignKey: 'user',
			},
		]);

		const User = mongoose.model(userSchema);

		type ItemModel = EnhancedModel<{
			user?: Types.ObjectId | ExtractEntryType<typeof User>;
			createdAt?: Date;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			createdAt: Date,
		});

		itemSchema.hasMany('SubItem', 'item');

		const Item = mongoose.model(itemSchema);

		type SubitemModel = EnhancedModel<{
			item?: Types.ObjectId | ExtractEntryType<typeof Item>;
		}>;

		const subItemSchema = mongoose.createSchema<SubitemModel>('SubItem', {
			item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
		});

		const SubItem = mongoose.model(subItemSchema);

		const user = await new User({
			name: 'User Name',
		}).save();

		expect(user.itemsCount).toBe(0);

		const item1 = await new Item({
			user: user._id,
			createdAt: new Date(),
		}).save();

		await user.restore();

		expect(user.itemsCount).toBe(1);

		const user2 = await new User({
			name: 'User Name 2',
		}).save();

		const item2 = await new Item({
			user: user2._id,
			createdAt: new Date(),
		}).save();

		await new Item({
			user: user2._id,
			createdAt: new Date(),
		}).save();

		await user.restore();
		await user2.restore();

		expect(user.itemsCount).toBe(1);
		expect(user2.itemsCount).toBe(2);

		await item1.remove();

		await user.restore();
		await user2.restore();

		expect(user.itemsCount).toBe(0);
		expect(user2.itemsCount).toBe(2);

		await new SubItem({
			item: item2._id,
		}).save();

		let subItemsCount = await SubItem.countDocuments({});
		expect(subItemsCount).toBe(1);

		await item2.remove();

		await user.restore();
		await user2.restore();

		expect(user.itemsCount).toBe(0);
		expect(user2.itemsCount).toBe(1);

		subItemsCount = await SubItem.countDocuments({});
		expect(subItemsCount).toBe(0);
	});

	it('should derive sum', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
			itemsViews?: number;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			itemsViews: Number,
		});

		mongoose.enhance.plugins.derived(userSchema, [
			{
				method: 'sum',
				localField: 'itemsViews',
				foreignModelName: 'Item',
				foreignKey: 'user',
				foreignSumKey: 'views',
			},
		]);

		const User = mongoose.model(userSchema);

		type ItemModel = EnhancedModel<{
			user?: Types.ObjectId | ExtractEntryType<typeof User>;
			views?: number;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		const Item = mongoose.model(itemSchema);

		const user = await new User({
			name: 'User Name',
		}).save();

		expect(user.itemsViews).toBe(0);

		const item1 = await new Item({
			user: user._id,
			views: 5,
		}).save();

		await user.restore();

		expect(user.itemsViews).toBe(5);

		const user2 = await new User({
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
		type BoardModel = EnhancedModel<{
			name?: string;
			publicItemsCount?: number;
		}>;

		const boardSchema = mongoose.createSchema<BoardModel>('Board', {
			name: String,
			publicItemsCount: Number,
		});

		boardSchema.hasMany('Item', 'user');

		mongoose.enhance.plugins.derived(boardSchema, [
			{
				method: 'custom',
				localField: 'publicItemsCount',
				calculate: async (entry) => {
					expect(entry).not.toBeNull();

					return mongoose.model<BoardItemModel>('BoardItem').countDocuments({
						board: entry._id,
						private: { $ne: true },
					});
				},
				subscribeInvalidations(invalidate) {
					mongoose.enhance.onceSchemaIsReady('BoardItem', (s) => {
						const schema = s as unknown as EnhancedSchema<BoardItemModel>;
						schema.whenPostModifiedOrNew(['board', 'private'], function () {
							return invalidate(this.board);
						});

						schema.whenPostRemoved(function () {
							return invalidate(this.board);
						});
					});
				},
			},
		]);

		boardSchema.hasMany('BoardItem', 'board');

		const Board = mongoose.model(boardSchema);

		type BoardItemModel = EnhancedModel<{
			board?: Types.ObjectId | ExtractEntryType<typeof Board>;
			private?: boolean;
		}>;

		const boardItemSchema = mongoose.createSchema<BoardItemModel>('BoardItem', {
			board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
			private: Boolean,
		});

		const BoardItem = mongoose.model(boardItemSchema);

		const board = await new Board({
			name: 'Board Name',
		}).save();

		await board.restore();

		expect(board.publicItemsCount).toBe(0);

		const boardItem1 = await new BoardItem({
			board: board._id,
			private: true,
		}).save();

		await board.restore();

		expect(board.publicItemsCount).toBe(0);

		const board2 = await new Board({
			name: 'User Name 2',
		}).save();

		await board2.restore();

		expect(board2.publicItemsCount).toBe(0);

		const boardItem2 = await new BoardItem({
			board: board2._id,
			private: false,
		}).save();

		await board.restore();
		await board2.restore();

		expect(board.publicItemsCount).toBe(0);
		expect(board2.publicItemsCount).toBe(1);

		const boardItem3 = await new BoardItem({
			board: board2._id,
			private: true,
		}).save();

		await board.restore();
		await board2.restore();

		expect(board.publicItemsCount).toBe(0);
		expect(board2.publicItemsCount).toBe(1);

		await boardItem1.remove();

		await board.restore();
		await board2.restore();

		expect(board.publicItemsCount).toBe(0);
		expect(board2.publicItemsCount).toBe(1);

		await boardItem3.remove();

		await board.restore();
		await board2.restore();

		expect(board.publicItemsCount).toBe(0);
		expect(board2.publicItemsCount).toBe(1);

		await boardItem2.remove();

		await board.restore();
		await board2.restore();

		expect(board.publicItemsCount).toBe(0);
		expect(board2.publicItemsCount).toBe(0);
	});

	it('should sync derived fields', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
			itemsViews?: number;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			itemsViews: { type: Number, default: 0 },
		});

		mongoose.enhance.plugins.derived(userSchema, [
			{
				method: 'sum',
				localField: 'itemsViews',
				foreignModelName: 'Item',
				foreignKey: 'user',
				foreignSumKey: 'views',
			},
		]);

		const User = mongoose.model(userSchema);

		type ItemModel = EnhancedModel<{
			user?: Types.ObjectId | ExtractEntryType<typeof User>;
			views?: number;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		const Item = mongoose.model(itemSchema);

		const user = await new User({
			name: 'User Name',
		}).save();

		const user2 = await new User({
			name: 'User Name 2',
		}).save();

		await Item.collection.insertMany([
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

	it('should update on chain dependencies', async () => {
		const fn = jest.fn();

		type UserModel = EnhancedModel<{
			name?: string;
			itemsCount?: number;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			itemsCount: Number,
		});

		mongoose.enhance.plugins.derived(userSchema, [
			{
				method: 'sum',
				localField: 'itemsCount',
				foreignModelName: 'Board',
				foreignKey: 'user',
				foreignSumKey: 'itemsCount',
			},
		]);

		userSchema.whenPostSave(() => {
			fn();
		});

		userSchema.hasMany('Board', 'user');

		const User = mongoose.model(userSchema);

		type BoardModel = EnhancedModel<{
			user?: Types.ObjectId | ExtractEntryType<typeof User>;
			itemsCount?: number;
		}>;

		const boardSchema = mongoose.createSchema<BoardModel>('Board', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			itemsCount: Number,
		});

		mongoose.enhance.plugins.derived(boardSchema, [
			{
				method: 'count',
				localField: 'itemsCount',
				foreignModelName: 'Item',
				foreignKey: 'board',
			},
		]);

		boardSchema.hasMany('Item', 'board');

		const Board = mongoose.model(boardSchema);

		type ItemModel = EnhancedModel<{
			board?: Types.ObjectId | ExtractEntryType<typeof Board>;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
		});

		const Item = mongoose.model(itemSchema);

		const user = await new User({
			name: 'User Name',
		}).save();

		const board = await new Board({
			user: user._id,
		}).save();

		await user.restore();
		expect(user.itemsCount).toBe(0);
		expect(fn).toHaveBeenCalledTimes(1);

		const item = await new Item({
			board: board._id,
		}).save();

		await user.restore();
		await board.restore();

		expect(user.itemsCount).toBe(1);
		expect(fn).toHaveBeenCalledTimes(2);
		expect(board.itemsCount).toBe(1);

		await item.remove();

		await user.restore();
		await board.restore();

		expect(user.itemsCount).toBe(0);
		expect(fn).toHaveBeenCalledTimes(3);
		expect(board.itemsCount).toBe(0);
	});

	// TODO: Use native mongo driver updates then manually call .syncDerived on the entry
	// it('should sync individual model', async () => {
	// 	type UserModel = EnhancedModel<
	// 		{
	// 			name?: string;
	// 			itemsCount?: number;
	// 		},
	// 		PluginDerivedMethods
	// 	>;

	// 	const userSchema = mongoose.createSchema<UserModel>('User', {
	// 		name: String,
	// 		itemsCount: Number,
	// 	});

	// 	userSchema.hasMany('Item', 'user');

	// 	mongoose.enhance.plugins.derived(userSchema, [
	// 		{
	// 			method: 'count',
	// 			localField: 'itemsCount',
	// 			foreignModelName: 'Item',
	// 			foreignKey: 'user',
	// 		},
	// 	]);

	// 	const User = mongoose.model(userSchema);

	// 	type ItemModel = EnhancedModel<{
	// 		user?: Types.ObjectId | ExtractEntryType<typeof User>;
	// 		createdAt?: Date;
	// 	}>;

	// 	const itemSchema = mongoose.createSchema<ItemModel>('Item', {
	// 		user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	// 		createdAt: Date,
	// 		ignore: Boolean,
	// 	});

	// 	const Item = mongoose.model(itemSchema);

	// 	const user = await new User({
	// 		name: 'User Name',
	// 	}).save();

	// 	expect(user.itemsCount).toBe(0);

	// 	const item1 = await new Item({
	// 		user: user._id,
	// 		createdAt: new Date(),
	// 		ignore: true,
	// 	}).save();

	// 	await user.restore();

	// 	expect(user.itemsCount).toBe(0);

	// 	item1.ignore = false;
	// 	await item1.save();

	// 	await user.restore();

	// 	expect(user.itemsCount).toBe(0);

	// 	const user2 = await user.syncDerived();

	// 	expect(user2).toBe(user);
	// 	expect(user.itemsCount).toBe(1);

	// 	await user.restore();

	// 	expect(user.itemsCount).toBe(1);
	// });
});
