const testMemoryServer = require('../__tests_utils__/testMemoryServer');

jest.setTimeout(30000);

let mongoose;

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

		const userSchema = new mongoose.EnhancedSchema({
			name: { type: String, unique: true },
		});

		userSchema.whenSaveError(async (error) => {
			fn(error);
		});

		mongoose.model('User', userSchema);

		mongoose.createModels();

		const User = mongoose.model('User');

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
