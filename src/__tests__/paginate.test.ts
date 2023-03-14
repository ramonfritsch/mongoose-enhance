import { EnhancedModel, ExtractEntryType } from '..';
import testMemoryServer from '../__tests_utils__/testMemoryServer';
import { Result } from '../pluginPaginate';

jest.setTimeout(30000);

let mongoose: Awaited<ReturnType<typeof testMemoryServer.createMongoose>>;

describe('paginate', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = await testMemoryServer.createMongoose();
	});

	afterEach(async () => {
		await mongoose.disconnect();
	});

	it('should paginate', async () => {
		type UserModel = EnhancedModel<{
			name?: string;
		}>;

		const userSchema = mongoose.createSchema<UserModel>('User', {
			name: String,
		});

		const User = mongoose.model(userSchema);

		for (let i = 0; i < 100; i++) {
			await new User({
				name: `Name${i + 1}`,
			}).save();
		}

		let result: Result<ExtractEntryType<typeof User>> = await new Promise((resolve, reject) => {
			User.paginate({ pageSize: 10 }).exec((err, data) =>
				err || !data ? reject(err) : resolve(data),
			);
		});

		expect(result.total).toBe(100);
		expect(result.entries.length).toBe(10);
		expect(result.entries[0].name).toBe('Name1');
		expect(result.entries[9].name).toBe('Name10');
		expect(result.currentPage).toBe(1);
		expect(result.totalPages).toBe(10);
		expect(result.pages.length).toBe(10);
		expect(result.pages[0].isCurrent).toBe(true);
		expect(result.previousPage).toBe(false);
		expect(result.nextPage).toBe(2);
		expect(result.firstPage).toBe(false);
		expect(result.lastPage).toBe(10);
		expect(result.first).toBe(1);
		expect(result.last).toBe(10);

		result = await new Promise((resolve, reject) => {
			User.paginate({ pageSize: 5, page: 5, maxPages: 4 }).exec((err, data) =>
				err || !data ? reject(err) : resolve(data),
			);
		});

		expect(result.total).toBe(100);
		expect(result.entries.length).toBe(5);
		expect(result.entries[0].name).toBe('Name21');
		expect(result.entries[4].name).toBe('Name25');
		expect(result.currentPage).toBe(5);
		expect(result.totalPages).toBe(20);
		expect(result.pages.length).toBe(5);
		expect(result.pages[2].isCurrent).toBe(true);
		expect(result.pages[2].page).toBe(5);
		expect(result.previousPage).toBe(4);
		expect(result.nextPage).toBe(6);
		expect(result.firstPage).toBe(1);
		expect(result.lastPage).toBe(20);
		expect(result.first).toBe(21);
		expect(result.last).toBe(25);
	});
});
