const testMemoryServer = require('../__tests_utils__/testMemoryServer');

jest.setTimeout(30000);

let mongoose;

describe('relationship', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should delete using hasMany', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
		});

		userSchema.hasMany('Item', 'user');

		mongoose.model('User', userSchema);

		const itemSchema = new mongoose.EnhancedSchema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		mongoose.model('Item', itemSchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');

		const user = await new User({
			name: 'Name',
		}).save();

		await new Item({
			user: user._id,
		}).save();

		await new Item({
			user: user._id,
		}).save();

		let items = await Item.find({ user: user._id });

		expect(items.length).toBe(2);

		await user.remove();

		items = await Item.find({ user: user._id });

		expect(items.length).toBe(0);
	});

	it('should delete using manyToOne', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		userSchema.manyToOne('Company', 'company');

		mongoose.model('User', userSchema);

		const companySchema = new mongoose.EnhancedSchema({
			name: String,
		});

		mongoose.model('Company', companySchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Company = mongoose.model('Company');

		const company = await new Company({
			name: 'Company',
		}).save();

		const user = await new User({
			name: 'Name',
			company,
		}).save();

		const user2 = await new User({
			name: 'Name 2',
			company,
		}).save();

		const user3 = await new User({
			name: 'Name 3',
		}).save();

		let count = await Company.countDocuments();

		expect(count).toBe(1);

		await user.remove();

		count = await Company.countDocuments();

		expect(count).toBe(1);

		await user3.remove();

		count = await Company.countDocuments();

		expect(count).toBe(1);

		await user2.remove();

		count = await Company.countDocuments();

		expect(count).toBe(0);
	});

	it('should sync relationships', async () => {
		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		userSchema.manyToOne('Company', 'company');
		userSchema.hasMany('Item', 'user');

		mongoose.model('User', userSchema);

		const companySchema = new mongoose.EnhancedSchema({
			name: String,
		});

		mongoose.model('Company', companySchema);

		const itemSchema = new mongoose.EnhancedSchema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		mongoose.model('Item', itemSchema);

		mongoose.createModels();

		const User = mongoose.model('User');
		const Company = mongoose.model('Company');
		const Item = mongoose.model('Item');

		const company = await new Company({
			name: 'Company',
		}).save();

		const user = await new User({
			name: 'Name',
			company,
		}).save();

		await new Item({
			user: user._id,
		}).save();

		const db = mongoose.connection.client.db();

		await db.collection('companies').insertMany([
			{
				name: 'Company 2',
			},
			{
				name: 'Company 3',
			},
		]);

		const missingUserID1 = new mongoose.Types.ObjectId();
		const missingUserID2 = new mongoose.Types.ObjectId();

		await db.collection('items').insertMany([
			{
				user: user._id,
			},
			{
				user: missingUserID1,
			},
			{
				user: missingUserID1,
			},
			{
				user: missingUserID2,
			},
		]);

		let companiesCount = await Company.countDocuments();
		let itemsCount = await Item.countDocuments();

		expect(companiesCount).toBe(3);
		expect(itemsCount).toBe(5);

		await mongoose.enhance.syncRelationships();

		companiesCount = await Company.countDocuments();
		itemsCount = await Item.countDocuments();

		expect(companiesCount).toBe(1);
		expect(itemsCount).toBe(2);
	});
});