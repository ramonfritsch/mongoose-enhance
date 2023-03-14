import { EnhancedModel } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('whenReady', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should fire callbacks', async () => {
		const fn = jest.fn();

		mongoose.enhance.onceSchemaIsReady('Company', (schema) => {
			fn('schemaReady:Company:' + schema.modelName);
		});

		mongoose.enhance.onceSchemaIsReady('User', (schema) => {
			fn('schemaReady:User:' + schema.modelName);
		});

		type CompanyModel = EnhancedModel<{
			name?: string;
		}>;

		const companySchema = mongoose.createSchema<CompanyModel>('Company', {
			name: String,
		});

		mongoose.enhance.onceModelIsReady('Company', (model) => {
			fn('modelReady:Company:' + model.modelName);
		});

		mongoose.enhance.onceModelIsReady('User', (model) => {
			fn('modelReady:User:' + model.modelName);
		});

		mongoose.model(companySchema);

		expect(fn).nthCalledWith(1, 'schemaReady:Company:Company');
		expect(fn).nthCalledWith(2, 'modelReady:Company:Company');
		expect(fn).toBeCalledTimes(2);

		type UserModel = EnhancedModel<{
			name: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: { type: String, required: true },
		});

		mongoose.model(userSchema);

		expect(fn).nthCalledWith(3, 'schemaReady:User:User');
		expect(fn).nthCalledWith(4, 'modelReady:User:User');
		expect(fn).toBeCalledTimes(4);

		mongoose.enhance.onceModelIsReady('Company', (model) => {
			fn('afterModelReady:Company:' + model.modelName);
		});

		expect(fn).nthCalledWith(5, 'afterModelReady:Company:Company');
		expect(fn).toBeCalledTimes(5);

		mongoose.enhance.onceModelIsReady('User', (model) => {
			fn('afterModelReady:User:' + model.modelName);
		});

		expect(fn).nthCalledWith(6, 'afterModelReady:User:User');
		expect(fn).toBeCalledTimes(6);
	});
});
