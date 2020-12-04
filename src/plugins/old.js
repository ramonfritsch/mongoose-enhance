module.exports = (mongoose) => {
	mongoose.enhance.registerPlugin((schema) => {
		schema.methods.setOld = function (path) {
			if (!this.$locals.old) {
				this.$locals.old = {};
			}
			this.$locals.old[path] = this.get(path);
		};

		schema.methods.getOld = function (path) {
			return this.$locals.old ? this.$locals.old[path] : null;
		};

		schema.methods.clearOld = function (path) {
			if (this.$locals.old) {
				delete this.$locals.old[path];
			}
		};
	});
};
