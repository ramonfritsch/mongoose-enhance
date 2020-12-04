module.exports = (mongoose) => {
	mongoose.enhance.registerPlugin((schema) => {
		schema.methods.setWasModified = function (path) {
			if (!this.$locals.wasModified) {
				this.$locals.wasModified = {};
			}

			if (!path) {
				this.$locals.wasModified['$$doc'] = this.isModified();

				return;
			}

			this.$locals.wasModified[path] = this.isModified(path);
		};

		schema.methods.wasModified = function (path) {
			if (!path) {
				return this.$locals.wasModified['$$doc'];
			}

			return this.$locals.wasModified ? this.$locals.wasModified[path] : false;
		};

		schema.methods.clearWasModified = function (path) {
			if (this.$locals.wasModified) {
				if (!path) {
					delete this.$locals.wasModified['$$doc'];
				}

				delete this.$locals.wasModified[path];
			}
		};
	});
};
