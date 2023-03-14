import { Schema } from 'mongoose';
import mongoose from './index';

//Email
class Email extends Schema.Types.String {
	constructor(path: string, options?: any, instance?: string) {
		super(path, options, instance);

		this.validate(mongoose.validation.isEmail, '{LABEL} is invalid.');
	}

	cast(value: any) {
		if (typeof value === 'string') {
			return mongoose.validation.formatEmail(value);
		} else {
			return '';
		}
	}
}

// function Email(/*path, options*/) {
// 	SchemaTypes.String.apply(this, arguments);

// 	this.validate(mongoose.validation.isEmail, '{LABEL} is invalid.');
// }

// util.inherits(Email, SchemaTypes.String);

// Email.prototype.cast = (value) => mongoose.validation.formatEmail(value);

//Username
class Username extends Schema.Types.String {
	constructor(path: string, options?: any, instance?: string) {
		super(path, options, instance);

		this.validate((value: any) => {
			if (typeof value === 'string') {
				return mongoose.validation.isUsername(value);
			} else {
				return false;
			}
		}, '{LABEL} is invalid. Use only letters, numbers or _ between 3 and 50 characters.');
	}

	cast(value: any) {
		if (typeof value === 'string') {
			return mongoose.validation.formatUsername(value);
		} else {
			return '';
		}
	}
}

// function Username(/*path, options*/) {
// 	SchemaTypes.String.apply(this, arguments);

// 	this.validate(
// 		(value) => mongoose.validation.isUsername(value),
// 		'{LABEL} is invalid. Use only letters, numbers or _ between 3 and 50 characters.',
// 	);
// }

// util.inherits(Username, SchemaTypes.String);

// Username.prototype.cast = (value) => mongoose.validation.formatUsername(value);

//URL
class URL extends Schema.Types.String {
	constructor(path: string, options?: any, instance?: string) {
		super(path, options, instance);

		this.validate(mongoose.validation.isURL, '{LABEL} is invalid.');
	}

	cast(value: any) {
		if (typeof value === 'string') {
			return mongoose.validation.formatURL(value);
		} else {
			return '';
		}
	}
}

// function URL(/*path, options*/) {
// 	SchemaTypes.String.apply(this, arguments);

// 	this.validate(mongoose.validation.isURL, '{LABEL} is invalid.');
// }

// util.inherits(URL, SchemaTypes.String);

// URL.prototype.cast = (value) => mongoose.validation.formatURL(value);

const ExtraSchemaTypes = {
	Email,
	Username,
	URL,
} as const;

const ExtraTypes = {
	Email: String,
	Username: String,
	URL: String,
} as const;

export default {
	ExtraSchemaTypes,
	ExtraTypes,
};
