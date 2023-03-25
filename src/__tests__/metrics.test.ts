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

	it('should inform the callback', async () => {
		const fn = jest.fn();

		mongoose.enhance.enableMetrics({
			thresholdInMilliseconds: 0,
			callback: async (info) => {
				fn(info.modelName);
			},
		});

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

		type ItemModel = EnhancedModel<{
			name?: string;
		}>;

		const itemSchema = mongoose.createSchema<ItemModel>('Item', {
			name: String,
		});

		const Item = mongoose.model(itemSchema);

		await new User({
			name: 'Name',
			email: 'email@gmail.com',
		}).save();

		await User.findOne({ name: 'User Name' }).name('name1').source(__filename).exec();

		await User.find({
			$or: [{ email: 'email@gmail.com' }, { email: '2' }],
		})
			.name('name2')
			.source(__filename)
			.exec();

		await Item.findOne({ name: 'Item name' }).name('name3').exec();

		await new Promise((resolve) => setImmediate(resolve));

		expect(fn).toHaveBeenCalledTimes(3);
		expect(fn).toHaveBeenNthCalledWith(1, 'User');
		expect(fn).toHaveBeenNthCalledWith(2, 'User');
		expect(fn).toHaveBeenNthCalledWith(3, 'Item');
	});

	it('should sample it properly', async () => {
		const fn = jest.fn();

		mongoose.enhance.enableMetrics({
			sampleRate: 3,
			thresholdInMilliseconds: 0,
			callback: async (info) => {
				fn(info.name);
			},
		});

		type UserModel = EnhancedModel<{
			name?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
		});

		const User = mongoose.model(userSchema);

		await new User({
			name: 'Name',
			email: 'email@gmail.com',
		}).save();

		await User.findOne({ name: 'User Name' }).name('name1').exec();
		await User.findOne({ name: 'User Name' }).name('name2').exec();
		await User.findOne({ name: 'User Name' }).name('name3').exec();
		await User.findOne({ name: 'User Name' }).name('name4').exec();
		await User.findOne({ name: 'User Name' }).name('name5').exec();
		await User.findOne({ name: 'User Name' }).name('name6').exec();
		await User.findOne({ name: 'User Name' }).name('name7').exec();

		await new Promise((resolve) => setImmediate(resolve));

		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn).toHaveBeenNthCalledWith(1, 'name3');
		expect(fn).toHaveBeenNthCalledWith(2, 'name6');
	});
});
