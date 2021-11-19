const testMemoryServer = require('../__tests_utils__/testMemoryServer');

jest.setTimeout(30000);

let mongoose;

describe('derived', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongooseWithMemoryServer();
	});

	afterEach(async () => {
		await testMemoryServer.closeMemoryServer(mongoose);
	});

	it('should derive count', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsCount: Number,
		});

		userSchema.hasMany('Item', 'user');

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'count',
				localKey: 'itemsCount',
				model: 'Item',
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

		user = await User.findOne({ _id: user._id });

		expect(user.itemsCount).toBe(1);

		let user2 = await new User({
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

		await new Item({
			user: user2._id,
			createdAt: new Date(),
			ignore: true,
		}).save();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsCount).toBe(1);
		expect(user2.itemsCount).toBe(2);

		await item1.remove();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsCount).toBe(0);
		expect(user2.itemsCount).toBe(2);

		await new SubItem({
			item: item2._id,
		}).save();

		let subItemsCount = await SubItem.countDocuments({});
		expect(subItemsCount).toBe(1);

		await item2.remove();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsCount).toBe(0);
		expect(user2.itemsCount).toBe(1);

		subItemsCount = await SubItem.countDocuments({});
		expect(subItemsCount).toBe(0);
	});

	it('should derive sum', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsViews: Number,
		});

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'sum',
				localKey: 'itemsViews',
				model: 'Item',
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

		user = await User.findOne({ _id: user._id });

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

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(17);

		await item1.remove();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(17);

		await item2.remove();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(10);
	});

	it('should sync derived fields', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			itemsViews: { type: Number, default: 0 },
		});

		userSchema.plugin(mongoose.enhance.plugins.derived, [
			{
				method: 'sum',
				localKey: 'itemsViews',
				model: 'Item',
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

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(0);
		expect(user2.itemsViews).toBe(0);

		await mongoose.enhance.sync();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(10);

		await new Item({
			user: user2._id,
			views: 12,
		}).save();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsViews).toBe(5);
		expect(user2.itemsViews).toBe(22);
	});
});
