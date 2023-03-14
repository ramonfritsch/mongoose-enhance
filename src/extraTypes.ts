import { Schema, Types } from 'mongoose';
import mongoose from './index';

require('mongoose-shortid-nodeps');

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

const ExtraSchemaTypes = {
	Email,
	Username,
	URL,
	ShortId: (Schema.Types as any).ShortId,
} as const;

const ExtraTypes = {
	Email: String,
	Username: String,
	URL: String,
	ShortId: (Types as any).ShortId,
} as const;

export default {
	ExtraSchemaTypes,
	ExtraTypes,
};
