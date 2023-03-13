import { EnhancedModel } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('extraTypes', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should support extra types', async () => {
		type UserModel = EnhancedModel<{
			email?: string;
			username?: string;
			url?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			// @ts-ignore
			email: mongoose.SchemaTypes.Email,
			// @ts-ignore
			username: mongoose.SchemaTypes.Username,
			// @ts-ignore
			url: mongoose.SchemaTypes.URL,
		});

		const User = mongoose.model(userSchema);

		const user = await new User({
			email: 'email@email.com',
			username: 'username',
			url: 'https://www.google.com',
		});

		await user.save();
	});

	// TODO: Test when model is in place to see if mongoose saves it correctly, we can improve the API from ensureEntry to doc.populate()...
});
