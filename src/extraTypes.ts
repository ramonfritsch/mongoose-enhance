import util from 'util';

import { SchemaTypes } from 'mongoose';
import mongoose from './index';

const ExtraSchemaTypes: any = {};
const ExtraTypes: any = {};

//Email
function Email(/*path, options*/) {
	SchemaTypes.String.apply(this, arguments);

	this.validate(mongoose.validation.isEmail, '{LABEL} is invalid.');
}

util.inherits(Email, SchemaTypes.String);

Email.prototype.cast = (value) => mongoose.validation.formatEmail(value);

ExtraSchemaTypes.Email = Email;
ExtraTypes.Email = String;

//Username
function Username(/*path, options*/) {
	SchemaTypes.String.apply(this, arguments);

	this.validate(
		(value) => mongoose.validation.isUsername(value),
		'{LABEL} is invalid. Use only letters, numbers or _ between 3 and 50 characters.',
	);
}

util.inherits(Username, SchemaTypes.String);

Username.prototype.cast = (value) => mongoose.validation.formatUsername(value);

ExtraSchemaTypes.Username = Username;
ExtraTypes.Username = String;

//URL
function URL(/*path, options*/) {
	SchemaTypes.String.apply(this, arguments);

	this.validate(mongoose.validation.isURL, '{LABEL} is invalid.');
}

util.inherits(URL, SchemaTypes.String);

URL.prototype.cast = (value) => mongoose.validation.formatURL(value);

ExtraSchemaTypes.URL = URL;
ExtraTypes.URL = String;

export default {
	ExtraSchemaTypes,
	ExtraTypes,
};
