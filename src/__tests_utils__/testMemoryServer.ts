import { MongoMemoryServer } from 'mongodb-memory-server';

const testMemoryServer = {
	async createMongoose() {
		const { default: mongoose } = await import('../index');

		const mongoMemoryServerInstance = await MongoMemoryServer.create();
		const mongoMemoryServerURI = mongoMemoryServerInstance.getUri();

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

export default testMemoryServer;
