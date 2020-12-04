const glob = require('glob');
const path = require('path');
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

mongoose.set('useCreateIndex', true);
mongoose.plugin((schema) => {
	schema.options.usePushEach = true;
});

glob.sync('*.js', {
	cwd: path.join(__dirname, 'plugins/'),
}).forEach((file) => require('./plugins/' + file)(mongoose));

module.exports = mongoose;

// TODO: function to run all hooks on existig database. derived and relationship needs it
//TODO: #270 Run script to clean children with missing parent for hasMany, hasOneShared
