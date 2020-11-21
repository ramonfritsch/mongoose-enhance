module.exports = (mongoose) => {
	mongoose.enhance.registerPlugin((schema) => {
		schema.methods.setOld = function (field) {
			if (!this.$old) {
				this.$old = {};
			}
			this.$old[field] = this.get(field);
		};

		schema.methods.getOld = function (field) {
			return this.$old ? this.$old[field] : null;
		};

		schema.methods.clearOld = function (field) {
			if (this.$old) {
				delete this.$old[field];
			}
		};
	});
};
