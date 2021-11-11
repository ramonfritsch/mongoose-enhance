const { reject } = require('lodash');
const MongoMemory = require('mongodb-memory-server');

jest.setTimeout(30000);

let mongoose;
let mongoMemoryServerInstance;

describe('when', () => {
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

	it('should fill out model', async () => {
		// const fn = jest.fn();

		const userSchema = new mongoose.EnhancedSchema({
			name: String,
			company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
		});

		mongoose.model('User', userSchema);

		const companySchema = new mongoose.EnhancedSchema({
			name: String,
		});

		mongoose.model('Company', companySchema);

		await mongoose.createModels();

		const User = mongoose.model('User');
		const Company = mongoose.model('Company');

		const originalFindOne = Company.findOne.bind(Company);
		Company.findOne = jest.fn(originalFindOne);

		const newCompany = await new Company({
			name: 'Company Name',
		}).save();

		await new User({
			name: 'User Name',
			company: newCompany._id,
		}).save();

		let user = await User.findOne({ name: 'User Name' }).exec();

		expect(user.name).toBe('User Name');
		expect(String(user.company)).toBe(String(newCompany._id));

		expect(Company.findOne).toBeCalledTimes(0);

		let company = await new Promise((resolve, reject) =>
			Company.ensureModel(user.company, { name: 'Some other Company' }, (err, company) =>
				err ? reject(err) : resolve(company),
			),
		);

		expect(company).toBe(null);
		expect(Company.findOne).toBeCalledTimes(1);

		company = await new Promise((resolve, reject) =>
			Company.ensureModel(user.company, (err, company) =>
				err ? reject(err) : resolve(company),
			),
		);

		expect(company.name).toBe('Company Name');
		expect(Company.findOne).toBeCalledTimes(2);

		user = await User.findOne({ name: 'User Name' }).populate('company').exec();

		expect(user.name).toBe('User Name');
		expect(user.company.name).toBe('Company Name');

		expect(Company.findOne).toBeCalledTimes(2);

		company = await new Promise((resolve, reject) =>
			Company.ensureModel(user.company, (err, company) =>
				err ? reject(err) : resolve(company),
			),
		);

		expect(company.name).toBe('Company Name');
		expect(Company.findOne).toBeCalledTimes(2);

		// Runs findOne anyway if query is present to make sure it's filtered
		company = await new Promise((resolve, reject) =>
			Company.ensureModel(user.company, { name: 'Some other Company' }, (err, company) =>
				err ? reject(err) : resolve(company),
			),
		);

		expect(company).toBe(null);
		expect(Company.findOne).toBeCalledTimes(3);
	});

	// TODO: Test when model is in place to see if mongoose saves it correctly, we can improve the API from ensureModel to doc.populate()...
});
