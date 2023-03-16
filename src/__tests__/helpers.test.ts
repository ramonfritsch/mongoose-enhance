import { EnhancedModel } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('helpers', () => {
	beforeEach(async () => {
		jest.resetModules();

		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should compare two models', async () => {
		const ModelA = mongoose.model(mongoose.createSchema<EnhancedModel>('ModelA', {}));
		const ModelB = mongoose.model(mongoose.createSchema<EnhancedModel>('ModelB', {}));

		const entry1 = new ModelA({});
		await entry1.save();

		const entry2 = new ModelA({});
		await entry2.save();

		const entry3 = new ModelB({});
		await entry3.save();

		const entry4 = (await ModelA.findOne({ _id: entry1._id! }))!;

		expect(mongoose.equals(entry1, entry1)).toBe(true);
		expect(mongoose.equals(entry1, entry4)).toBe(true);
		expect(mongoose.equals(entry1, entry4._id!)).toBe(true);
		expect(mongoose.equals(entry1._id!, entry4)).toBe(true);
		expect(mongoose.equals(String(entry1._id!), entry4)).toBe(true);
		expect(mongoose.equals(entry1, String(entry4._id))).toBe(true);
		expect(mongoose.equals(entry1, mongoose.Types.ObjectId(String(entry4._id)))).toBe(true);
		expect(mongoose.equals(entry1, { _id: String(entry4._id) })).toBe(true);

		expect(mongoose.equals(entry1, entry2)).toBe(false);
		expect(mongoose.equals(entry1, entry3)).toBe(false);
		expect(mongoose.equals(entry2, entry3)).toBe(false);
	});

	it('should not encode asset URL', () => {
		const domainUrl = 'https://madebysix.com/project/kinfolk';
		const assetUrl =
			'https://six.imgix.net/https%3A%2F%2Fimages.prismic.io%2Fsix-page%2F9643b029-1f7d-4888-a2cc-50f23fd4a27d_Kinfolk_08%402x.png%3Fauto%3Dcompress%2Cformat?w=2560&h=1472&fit=crop&auto=compress%2Cformat&crop=undefined&q=90&ixlib=js-1.4.1&s=74fcf8fb935e7fdf3f3a9d38354c9c5a';
		const assetUrlObject = new URL(assetUrl);

		expect(mongoose.validation.formatURL(domainUrl, assetUrl)).toEqual(
			assetUrlObject.toString(),
		);
	});
});
