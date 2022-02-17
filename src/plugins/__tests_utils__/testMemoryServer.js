const { MongoMemoryServer } = require('mongodb-memory-server');

const testMemoryServer = {
	async createMongoose() {
		const mongoose = require('../../index');

		const mongoMemoryServerInstance = await MongoMemoryServer.create();
		const mongoMemoryServerURI = mongoMemoryServerInstance.getUri();

		mongoose._mongoMemoryServerInstance = mongoMemoryServerInstance;

		await mongoose.connect(mongoMemoryServerURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		const originalDisconnect = mongoose.disconnect.bind(mongoose);

		mongoose.disconnect = async () => {
			await originalDisconnect();

			mongoMemoryServerInstance.stop();
		};

		return mongoose;
	},
};

module.exports = testMemoryServer;
