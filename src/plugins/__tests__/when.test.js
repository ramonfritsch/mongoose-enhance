const MongoMemory = require('mongodb-memory-server');

jest.setTimeout(30000);

function expectSequence(fn, count, mod = count) {
	for (let i = 1; i <= count; i++) {
		expect(fn).nthCalledWith(i, 1 + ((i - 1) % mod));
	}

	expect(fn).toBeCalledTimes(count);
}

let mongoose;
let mongoMemoryServerInstance;

describe('when', () => {
	beforeEach(async () => {
		jest.resetModules();
		mongoose = require('../../index');

		mongoMemoryServerInstance = new MongoMemory.MongoMemoryServer();
		const mongoMemoryServerURI = await mongoMemoryServerInstance.getUri();

		await mongoose.connect(mongoMemoryServerURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
	});

	afterEach(async () => {
		await mongoose.disconnect();
		mongoMemoryServerInstance.stop();
	});

	it('should call whenNew callbacks', async () => {
		const fn = jest.fn();

		const userSchema = new mongoose.Schema({
			name: String,
		});

		userSchema.whenPostNew(function () {
			fn(8);
		});

		userSchema.whenPostNew(function (next) {
			fn(9);
			setTimeout(() => {
				fn(10);
				next();
			}, 100);
		});
		userSchema.whenPostNew(function () {
			fn(11);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(12);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenPostNew(function (next) {
			fn(13);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(14);
					resolve();
				}, 50),
			);
		});

		userSchema.whenNew(function () {
			fn(1);
		});
		userSchema.whenNew(function (next) {
			fn(2);
			setTimeout(() => {
				fn(3);
				next();
			}, 100);
		});
		userSchema.whenNew(function () {
			fn(4);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(5);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenNew(function (next) {
			fn(6);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(7);
					resolve();
				}, 50),
			);
		});

		mongoose.model('User', userSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');

		const newUser = await new User({
			name: 'User Name',
		}).save();

		newUser.name = 'Other Name';
		await newUser.save();

		expectSequence(fn, 14);
	});

	it('should call whenModified callbacks', async () => {
		const fn = jest.fn();
		const fn2 = jest.fn();

		const userSchema = new mongoose.Schema({
			name: String,
			nested: {
				field: String,
			},
			parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		userSchema.whenPostModified('name', function () {
			fn(8);
		});

		userSchema.whenPostModified('name', function (next) {
			fn(9);
			setTimeout(() => {
				fn(10);
				next();
			}, 100);
		});
		userSchema.whenPostModified('name', function () {
			fn(11);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(12);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenPostModified('name', function (next) {
			fn(13);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(14);
					resolve();
				}, 50),
			);
		});

		userSchema.whenModified('name', function () {
			fn(1);
			fn2(this.getOld('name'), this.get('name'));
		});
		userSchema.whenModified('name', function (next) {
			fn(2);
			setTimeout(() => {
				fn(3);
				next();
			}, 100);
		});
		userSchema.whenModified('name', function () {
			fn(4);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(5);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenModified('name', function (next) {
			fn(6);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(7);
					resolve();
				}, 50),
			);
		});

		userSchema.whenModified('nested.field', function () {
			fn(15);
		});

		userSchema.whenModified('parent', function () {
			fn(16);
		});

		mongoose.model('User', userSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');

		let user = await new User({
			name: 'Name 1',
		}).save();

		expect(fn).toBeCalledTimes(0);

		user.name = 'Name 2';
		await user.save();

		user = await User.findById(user._id);

		user.name = 'Name 3';
		await user.save();

		expectSequence(fn, 28, 14);
		expect(fn2).nthCalledWith(1, 'Name 1', 'Name 2');
		expect(fn2).nthCalledWith(2, 'Name 2', 'Name 3');

		user = await User.findById(user._id);

		user.nested = {};
		await user.save();

		expect(fn).toBeCalledTimes(28);

		user.set('nested.field', 'Some string');
		await user.save();

		expect(fn).toBeCalledTimes(29);
		expect(fn).nthCalledWith(29, 15);

		let user2 = await new User({
			parent: user,
		}).save();

		const user3 = await new User({
			parent: user,
		}).save();

		expect(fn).toBeCalledTimes(29);

		user2.parent = user3;
		await user2.save();

		expect(fn).toBeCalledTimes(30);

		user2 = await User.findById(user2._id);

		user2.parent = user3;
		await user2.save();

		expect(fn).toBeCalledTimes(30);

		await user2.save();

		expect(fn).toBeCalledTimes(30);

		user = await User.findById(user._id);
		await user.save();

		expect(fn).toBeCalledTimes(30);
	});

	it('should call whenModifiedOrNew callbacks', async () => {
		const fn = jest.fn();
		const fn2 = jest.fn();

		const userSchema = new mongoose.Schema({
			name: String,
		});

		userSchema.whenPostModifiedOrNew('name', function () {
			fn(8);
		});

		userSchema.whenPostModifiedOrNew('name', function (next) {
			fn(9);
			setTimeout(() => {
				fn(10);
				next();
			}, 100);
		});
		userSchema.whenPostModifiedOrNew('name', function () {
			fn(11);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(12);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenPostModifiedOrNew('name', function (next) {
			fn(13);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(14);
					resolve();
				}, 50),
			);
		});

		userSchema.whenModifiedOrNew('name', function () {
			fn(1);
			fn2(this.getOld('name'), this.get('name'));
		});
		userSchema.whenModifiedOrNew('name', function (next) {
			fn(2);
			setTimeout(() => {
				fn(3);
				next();
			}, 100);
		});
		userSchema.whenModifiedOrNew('name', function () {
			fn(4);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(5);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenModifiedOrNew('name', function (next) {
			fn(6);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(7);
					resolve();
				}, 50),
			);
		});

		mongoose.model('User', userSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');

		let user = await new User({
			name: 'Name 1',
		}).save();

		expect(fn).toBeCalledTimes(14);

		user.name = 'Name 2';
		await user.save();

		user = await User.findById(user._id);

		user.name = 'Name 3';
		await user.save();

		expectSequence(fn, 14 * 3, 14);
		expect(fn2).nthCalledWith(1, null, 'Name 1');
		expect(fn2).nthCalledWith(2, 'Name 1', 'Name 2');
		expect(fn2).nthCalledWith(3, 'Name 2', 'Name 3');

		await user.save();

		expect(fn).toBeCalledTimes(14 * 3);

		user = await User.findById(user._id);
		await user.save();

		expect(fn).toBeCalledTimes(14 * 3);
	});

	it('should call whenRemoved callback', async () => {
		const fn = jest.fn();

		const userSchema = new mongoose.Schema({
			name: String,
		});

		userSchema.hasMany('Item', 'user');

		userSchema.whenPostRemoved(function () {
			fn(8);
		});
		userSchema.whenPostRemoved(function (next) {
			fn(9);
			setTimeout(() => {
				fn(10);
				next();
			}, 100);
		});
		userSchema.whenPostRemoved(function () {
			fn(11);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(12);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenPostRemoved(function (next) {
			fn(13);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(14);
					resolve();
				}, 50),
			);
		});

		userSchema.whenRemoved(function () {
			fn(1);
		});
		userSchema.whenRemoved(function (next) {
			fn(2);
			setTimeout(() => {
				fn(3);
				next();
			}, 100);
		});
		userSchema.whenRemoved(function () {
			fn(4);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(5);
					resolve();
				}, 50),
			);
		});
		// eslint-disable-next-line no-unused-vars
		userSchema.whenRemoved(function (next) {
			fn(6);
			return new Promise((resolve) =>
				setTimeout(() => {
					fn(7);
					resolve();
				}, 50),
			);
		});

		mongoose.model('User', userSchema);

		const itemSchema = new mongoose.Schema({
			user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		});

		mongoose.model('Item', itemSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');
		const Item = mongoose.model('Item');

		let user = await new User({
			name: 'Name 1',
		}).save();

		expect(fn).toBeCalledTimes(0);

		await user.remove();

		expectSequence(fn, 14);

		user = await new User({
			name: 'Name 2',
		}).save();

		expect(fn).toBeCalledTimes(14);

		user = await User.findById(user._id);

		await new Item({
			user: user._id,
		}).save();

		let itemsCount = await Item.countDocuments({});

		expect(itemsCount).toBe(1);

		await user.remove();

		expectSequence(fn, 28, 14);

		itemsCount = await Item.countDocuments({});

		expect(itemsCount).toBe(0);
	});

	it('should save documents properly inside post callbacks', async () => {
		const fn = jest.fn();

		const userSchema = new mongoose.Schema({
			name: String,
			derivedName: String,
			derivedName2: String,
			willChange: String,
			derivedWillChange: String,
			derivedWillChange2: String,
		});

		userSchema.whenNew(function () {
			this.name = 'name';
		});

		userSchema.whenPostNew(function () {
			this.derivedName = `${this.name}-derived`;
			return this.save();
		});

		userSchema.whenPostNew(function () {
			this.derivedName2 = `${this.name}-derived2`;
			return this.save();
		});

		userSchema.whenPostModified('willChange', function () {
			this.derivedWillChange = `${this.willChange}-derived3`;
			return this.save();
		});

		userSchema.whenPostModified('willChange', function () {
			this.derivedWillChange2 = `${this.willChange}-derived4`;
			return this.save();
		});

		mongoose.model('User', userSchema);

		await mongoose.createModels();

		const User = mongoose.model('User');

		const newUser = await new User({}).save();

		expect(newUser.name).toBe('name');
		expect(newUser.derivedName).toBe('name-derived');
		expect(newUser.derivedName2).toBe('name-derived2');

		newUser.willChange = 'something';

		await newUser.save();

		expect(newUser.name).toBe('name');
		expect(newUser.derivedName).toBe('name-derived');
		expect(newUser.derivedName2).toBe('name-derived2');
		expect(newUser.willChange).toBe('something');
		expect(newUser.derivedWillChange).toBe('something-derived3');
		expect(newUser.derivedWillChange2).toBe('something-derived4');
	});
});
