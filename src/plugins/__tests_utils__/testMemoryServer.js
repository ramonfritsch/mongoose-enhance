const MongoMemory = require('mongodb-memory-server');

const testMemoryServer = {
	async createMongooseWithMemoryServer() {
		const mongoose = require('../../index');

		mongoMemoryServerInstance = new MongoMemory.MongoMemoryServer();
		const mongoMemoryServerURI = await mongoMemoryServerInstance.getUri();

		mongoose._mongoMemoryServerInstance = mongoMemoryServerInstance;

		await mongoose.connect(mongoMemoryServerURI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		return mongoose;
	},

	async closeMemoryServer(mongoose) {
		await mongoose.disconnect();
		mongoose._mongoMemoryServerInstance.stop();
	},
};

module.exports = testMemoryServer;
