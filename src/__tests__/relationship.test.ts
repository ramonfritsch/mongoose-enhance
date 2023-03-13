import { EnhancedModel, ExtractEntryType, ObjectId } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('relationship', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should delete using hasMany', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
		});

		userSchema.hasMany('Item', 'user');

		const User = mongoose.model(userSchema);

		type ItemModel = EnhancedModel<{
			user?: ObjectId | ExtractEntryType<typeof User>;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		const Item = mongoose.model(itemSchema);

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
		type UserModel = EnhancedModel<{
			name?: string;
			company?: ObjectId | ExtractEntryType<CompanyModel>;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		userSchema.manyToOne('Company', 'company');

		const User = mongoose.model(userSchema);

		type CompanyModel = EnhancedModel<{
			name?: string;
		}>;

		const companySchema = mongoose.createSchema<CompanyModel>('Company', {
			name: String,
		});

		const Company = mongoose.model(companySchema);

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
		type UserModel = EnhancedModel<{
			name?: string;
			company?: ObjectId | ExtractEntryType<CompanyModel>;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		userSchema.manyToOne('Company', 'company');
		userSchema.hasMany('Item', 'user');

		const User = mongoose.model(userSchema);

		type CompanyModel = EnhancedModel<{
			name?: string;
		}>;

		const companySchema = mongoose.createSchema<CompanyModel>('Company', {
			name: String,
		});

		const Company = mongoose.model(companySchema);

		type ItemModel = EnhancedModel<{
			user?: ObjectId | ExtractEntryType<typeof User>;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		const Item = mongoose.model(itemSchema);

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

		await Company.collection.insertMany([
			{
				name: 'Company 2',
			},
			{
				name: 'Company 3',
			},
		]);

		const missingUserID1 = new mongoose.Types.ObjectId();
		const missingUserID2 = new mongoose.Types.ObjectId();

		await Item.collection.insertMany([
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
