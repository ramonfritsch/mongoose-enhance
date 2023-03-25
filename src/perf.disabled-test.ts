import { EnhancedModel } from '.';
import testMemoryServer from './__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('perf', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should be faster to have a smaller model?', async () => {
		type BigModel = EnhancedModel<{
			name?: string;
		}>;

		const bigSchema = mongoose.createSchema<BigModel>('Big', {
			name: String,
		});

		const n = 4000;

		for (let i = 0; i < n; i++) {
			bigSchema.statics[`static${i}`] = async () => null;
		}

		for (let i = 0; i < n; i++) {
			bigSchema.methods[`method${i}`] = async () => null;
		}

		for (let i = 0; i < n; i++) {
			bigSchema
				.virtual(`virtual${i}`)
				.get(() => null)
				.set(() => null);
		}

		for (let i = 0; i < n; i++) {
			bigSchema.whenModified('name', async () => null);
		}

		const Big = mongoose.model(bigSchema);

		type SmallModel = EnhancedModel<{
			name?: string;
		}>;

		const smallSchema = mongoose.createSchema<SmallModel>('User', {
			name: String,
		});

		const Small = mongoose.model(smallSchema);

		const count = 1000;

		for (let i = 0; i < count; i++) {
			await Big.create({
				name: 'Big',
			});
		}

		for (let i = 0; i < count; i++) {
			await Small.create({
				name: 'Small',
			});
		}

		// warm up finds
		await Big.find({});
		await Small.find({});
		await Big.find({});
		await Small.find({});

		const smallStart = performance.now();
		await Small.find({});
		const smallDuration = performance.now() - smallStart;

		console.log(smallDuration, 'ms');

		const bigStart = performance.now();
		await Big.find({});
		const bigDuration = performance.now() - bigStart;

		console.log(bigDuration, 'ms');

		const lsmallStart = performance.now();
		await Small.find({}).lean();
		const lsmallDuration = performance.now() - lsmallStart;

		console.log(lsmallDuration, 'ms');

		const lbigStart = performance.now();
		await Big.find({}).lean();
		const lbigDuration = performance.now() - lbigStart;

		console.log(lbigDuration, 'ms');
	});
});
