module.exports = (mongoose) => {
	mongoose.enhance.registerGlobalPlugin((schema) => {
		schema.methods.restore = async function () {
			const entry = await this.constructor.findOne({
				_id: this._id,
			});

			if (entry) {
				this.set(entry);
			}

			return this;
		};
	});
};
