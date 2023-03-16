import { EnhancedModel, ExtractEntryType, Types } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('ensureModel', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should fill out model', async () => {
		type CompanyModel = EnhancedModel<{
			name?: string;
		}>;

		const companySchema = mongoose.createSchema<CompanyModel>('Company', {
			name: String,
		});

		const Company = mongoose.model(companySchema);

		type UserModel = EnhancedModel<{
			name?: string;
			company?: Types.ObjectId | ExtractEntryType<typeof Company>;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		const User = mongoose.model(userSchema);

		Company.findOne = jest.fn(Company.findOne.bind(Company));

		const newCompany = await new Company({
			name: 'Company Name',
		}).save();

		await new User({
			name: 'User Name',
			company: newCompany._id,
		}).save();

		let user = (await User.findOne({ name: 'User Name' }).exec())!;

		expect(user.name).toBe('User Name');
		expect(String(user.company)).toBe(String(newCompany._id));

		expect(Company.findOne).toBeCalledTimes(0);

		let company = await Company.ensureEntry(user.company!);

		expect(company.name).toBe('Company Name');
		expect(Company.findOne).toBeCalledTimes(1);

		user = (await User.findOne({ name: 'User Name' }).populate('company').exec())!;

		expect(user.name).toBe('User Name');
		expect((user.company as any).name).toBe('Company Name');

		expect(Company.findOne).toBeCalledTimes(1);

		company = await Company.ensureEntry(user.company!);

		expect(company.name).toBe('Company Name');
		expect(Company.findOne).toBeCalledTimes(1);

		await user.save();

		await user.restore();

		expect(String(user.company)).toBe(String(newCompany._id));
	});

	// TODO: Test when model is in place to see if mongoose saves it correctly, we can improve the API from ensureEntry to doc.populate()...
});
