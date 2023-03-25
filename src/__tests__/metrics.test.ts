import { EnhancedModel } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('metrics', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should fill out model', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
			email?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
			email: String,
		});

		userSchema.index({ email: 1 });

		const User = mongoose.model(userSchema);

		await new User({
			name: 'Name',
			email: 'email@gmail.com',
		}).save();

		const user = (await User.findOne({ name: 'User Name' }).exec())!;

		const users = (await User.find({
			$or: [{ email: 'email@gmail.com' }, { email: '2' }],
		}).exec())!;
	});
});
