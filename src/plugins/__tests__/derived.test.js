const MongoMemory = require('mongodb-memory-server');

jest.setTimeout(30000);

let mongoose;
let mongoMemoryServerInstance;

describe('derived', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = require('../../index');

		mongoMemoryServerInstance = new MongoMemory.MongoMemoryServer();
		const mongoMemoryServerURI = await mongoMemoryServerInstance.getUri();

		await mongoose.connect(mongoMemoryServerURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
	});

	afterEach(async () => {
		await mongoose.disconnect();
		mongoMemoryServerInstance.stop();
	});

	it('should derive count', async () => {
		const userSchema = new mongoose.Schema({
			name: String,
			itemsCount: Number,
		});

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

		const itemSchema = new mongoose.Schema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			createdAt: Date,
			ignore: Boolean,
		});

		mongoose.model('Item', itemSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');

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

		await item2.remove();

		user = await User.findOne({ _id: user._id });
		user2 = await User.findOne({ _id: user2._id });

		expect(user.itemsCount).toBe(0);
		expect(user2.itemsCount).toBe(1);
	});

	it('should derive sum', async () => {
		const userSchema = new mongoose.Schema({
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

		const itemSchema = new mongoose.Schema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		mongoose.model('Item', itemSchema);

		await mongoose.createModels();

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
		const userSchema = new mongoose.Schema({
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

		const itemSchema = new mongoose.Schema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
			views: Number,
		});

		mongoose.model('Item', itemSchema);

		await mongoose.createModels();

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
