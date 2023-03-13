import { EnhancedModel } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('when', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should not let insert duplicated values', async () => {
		const fn = jest.fn();

		type UserModel = EnhancedModel<{
			name?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: { type: String, unique: true },
		});

		userSchema.whenSaveError(async (error) => {
			fn(error);
		});

		const User = mongoose.model(userSchema);

		await new User({
			name: 'User Name',
		}).save();

		expect(await User.countDocuments()).toBe(1);

		let error = null;
		try {
			await new User({
				name: 'User Name',
			}).save();
		} catch (e) {
			error = e;
		}

		expect(error).not.toBeNull();
		expect(await User.countDocuments()).toBe(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
