const helpers = require('./helpers');
const mongoose = require('mongoose');

if (global.Promise) {
	mongoose.Promise = global.Promise;
}

mongoose.enhance = {
	plugins: {},
};

Object.keys(helpers).forEach(
	(key) =>
		(mongoose[key] =
			typeof helpers[key] === 'function' ? helpers[key].bind(mongoose) : helpers[key]),
);

require('mongoose-strip-html-tags')(mongoose);
require('mongoose-shortid-nodeps');

mongoose.plugin((schema) => {
	schema.options.usePushEach = true;
});

require('./plugins/base')(mongoose);
require('./plugins/derived')(mongoose);
require('./plugins/ensureModel')(mongoose);
require('./plugins/old')(mongoose);
require('./plugins/paginate')(mongoose);
require('./plugins/relationship')(mongoose);
require('./plugins/types')(mongoose);
require('./plugins/validators')(mongoose);
require('./plugins/wasModified')(mongoose);
require('./plugins/when')(mongoose);
require('./plugins/restore')(mongoose);

module.exports = mongoose;

// TODO: function to run all hooks on existing database. derived and relationship needs it
// TODO: #270 Run script to clean children with missing parent for hasMany, hasOneShared
