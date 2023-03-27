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
				fn(info);
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

		const user = await new User({
			name: 'Name',
			email: 'email@gmail.com',
		}).save();

		await User.findOne({ name: 'Name' }).name('name1').source(__filename).exec();

		await User.find({
			$or: [{ email: 'email@gmail.com' }, { email: '2' }],
		})
			.name('name2')
			.source(__filename)
			.exec();

		await Item.findOne({ name: 'Item name' }).name('name3').exec();

		await User.findOne({ _id: user._id }).name('name4').exec();

		await User.findOne({ _id: mongoose.id(String(user._id)) })
			.name('name5')
			.exec();

		await new Promise((resolve) => setImmediate(resolve));

		expect(fn).toHaveBeenCalledTimes(5);
		expect(fn.mock.calls[0][0].modelName).toBe('User');
		expect(fn.mock.calls[0][0].type).toBe('findOne');
		expect(fn.mock.calls[0][0].duration).toBeGreaterThan(0);
		expect(fn.mock.calls[0][0].name).toBe('name1');
		expect(fn.mock.calls[0][0].source).toBe('/src/__tests__/metrics.test.ts');
		expect(fn.mock.calls[0][0].filter).toBeInstanceOf(Object);
		expect(fn.mock.calls[0][0].filterSignature).toEqual({ name: 1 });
		expect(fn.mock.calls[0][0].options).toBeInstanceOf(Object);
		expect(fn.mock.calls[0][0].stages).toEqual(['COLLSCAN', 'LIMIT']);
		expect(fn.mock.calls[0][0].count).toBeGreaterThan(0);
		expect(fn.mock.calls[0][0].internalDuration).toBeGreaterThanOrEqual(0);
		expect(fn.mock.calls[0][0].keysExamined).toBeGreaterThanOrEqual(0);
		expect(fn.mock.calls[0][0].docsExamined).toBeGreaterThan(0);
		expect(fn.mock.calls[1][0].modelName).toBe('User');
		expect(fn.mock.calls[1][0].name).toBe('name2');
		expect(fn.mock.calls[1][0].filterSignature).toEqual({ $or: [{ email: 1 }, '...'] });
		expect(fn.mock.calls[2][0].modelName).toBe('Item');
		expect(fn.mock.calls[2][0].name).toBe('name3');
		expect(fn.mock.calls[2][0].filterSignature).toEqual({ name: 1 });
		expect(fn.mock.calls[3][0].modelName).toBe('User');
		expect(fn.mock.calls[3][0].name).toBe('name4');
		expect(fn.mock.calls[3][0].filterSignature).toEqual({ _id: 1 });
		expect(fn.mock.calls[4][0].modelName).toBe('User');
		expect(fn.mock.calls[4][0].name).toBe('name5');
		expect(fn.mock.calls[4][0].filterSignature).toEqual({ _id: 1 });
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
