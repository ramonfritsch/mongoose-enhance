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
			shortID?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>(
			'User',
			{
				email: mongoose.SchemaTypes.Email,
				username: mongoose.SchemaTypes.Username,
				url: mongoose.SchemaTypes.URL,
				shortID: mongoose.SchemaTypes.ShortId,
			},
			{
				timestamps: true,
			},
		);

		const User = mongoose.model(userSchema);

		const user = await new User({
			email: 'email@email.com',
			username: 'username',
			url: 'https://www.google.com',
		});

		await user.save();

		expect(user.shortID!.length).toBeGreaterThan(0);

		// expect(async () => {
		await new User({
			email: 'email2email.com',
			username: 'username',
			url: 'https://www.google.com',
		}).save();
		// }).rejects.toThrow('Email is invalid');

		expect(async () => {
			await new User({
				email: 'email@email.com',
				username: 'username 3',
				url: 'https://www.google.com',
			}).save();
		}).rejects.toThrow();

		expect(async () => {
			await new User({
				email: 'email@email.com',
				username: 'username.3',
				url: 'https://www.google.com',
			}).save();
		}).rejects.toThrow();

		expect(async () => {
			await new User({
				email: 'email@email.com',
				username: 'username',
				url: 'http://2ww.google.com',
			}).save();
		}).rejects.toThrow();
	});

	it('should support nested schemas', async () => {
		type UserMegaphoneModel = EnhancedModel<{
			name?: string;
		}>;

		const userMegaphoneSchema = mongoose.createSchema<UserMegaphoneModel>(
			'UserMegaphone',
			{
				name: String,
			},
			{
				timestamps: true,
			},
		);

		type UserModel = EnhancedModel<{
			megaphones?: Array<UserMegaphoneModel>;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			megaphones: [userMegaphoneSchema],
		});

		const User = mongoose.model(userSchema);

		const user = await new User({
			megaphones: [
				{
					name: 'Test 1',
				},
			],
		});

		await user.save();

		expect(user.megaphones![0].name).toBe('Test 1');
	});
});
