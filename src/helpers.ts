import _ from 'lodash';
import normalizeURL from 'normalize-url';
import pLimit from 'p-limit';
import path from 'path';
import url from 'url';
import validator from 'validator';
import { Document, EnhancedEntry, LeanDocument, QueryCursor, Types } from '.';

const helpers = {
	isEntry: <TEntry extends EnhancedEntry>(entry: any): entry is TEntry => {
		return entry instanceof Document;
	},
	id: (entry: EnhancedEntry | LeanDocument<any> | string | Types.ObjectId): Types.ObjectId => {
		if (helpers.isEntry(entry)) {
			return entry._id || Types.ObjectId();
		} else if (typeof entry === 'string') {
			return Types.ObjectId(entry);
		} else if (entry && typeof entry === 'object' && '_id' in entry) {
			return Types.ObjectId(String(entry._id));
		} else if (entry) {
			return Types.ObjectId(String(entry));
		}

		return Types.ObjectId();
	},
	equals: (
		id1: EnhancedEntry | string | Types.ObjectId | LeanDocument<any> | undefined,
		id2: EnhancedEntry | string | Types.ObjectId | LeanDocument<any> | undefined,
	) => id1 && id2 && String(helpers.id(id1)) == String(helpers.id(id2)),
	ciQuery: (value: string, loose?: boolean) =>
		new RegExp(
			(loose ? '' : '^') + _.escapeRegExp((value || '').toLowerCase()) + (loose ? '' : '$'),
			'i',
		),
	cursorEachAsyncLimit: async <TEntry extends EnhancedEntry = EnhancedEntry>(
		concurrentLimit: number,
		cursor: QueryCursor<TEntry>,
		eachCallback: (entry: TEntry) => Promise<any>,
	) => {
		const limit = pLimit(concurrentLimit);

		await cursor.eachAsync((entry) => {
			limit((entry) => eachCallback(entry), entry);
		});

		while (limit.pendingCount + limit.activeCount) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	},
	validation: {
		isEmail(email: string | null | undefined): boolean {
			if (!email) {
				return false;
			}

			return validator.isEmail(email);
		},
		formatEmail(email: string | null | undefined) {
			if (!email) {
				return null;
			}

			return String(email).toLowerCase();
		},
		isUsername(
			username: string | null | undefined,
			type: 'instagram' | 'twitter' | undefined = undefined,
		) {
			//Instagram: 30, Twitter: 15, Tumblr: 32, Facebook: 50

			if (!username) {
				return false;
			}

			if (type == 'instagram') {
				return /^[a-zA-Z0-9_]{1,30}$/.test(username);
			} else if (type == 'twitter') {
				return /^[a-zA-Z0-9_]{1,15}$/.test(username);
			}

			return /^[a-zA-Z0-9_]{1,50}$/.test(username);
		},
		formatUsername(username: string | null | undefined) {
			if (!username) {
				return null;
			}

			return String(String(username).split('@').join('').split(' ')[0]).toLowerCase();
		},
		formatURL(baseURLOrPathname: string, pathnameOrEmpty?: string): string {
			let baseURL: string | undefined = baseURLOrPathname;
			let pathname: string | undefined = pathnameOrEmpty;

			if (arguments.length === 1) {
				pathname = baseURL;
				baseURL = undefined;
			}

			if (!pathname) {
				return '';
			}

			//Do not format base64 img urls
			if (pathname?.indexOf(';base64,') !== -1) {
				return pathname;
			}

			if (baseURL) {
				if (pathname.indexOf('://') == -1 || pathname.indexOf('://') > 5) {
					const parsed = url.parse(baseURL);

					if (parsed.host) {
						const pathnameParsed = url.parse(pathname);

						parsed.protocol = parsed.protocol || 'http';
						parsed.pathname = path.join(
							parsed.pathname || '',
							pathnameParsed.pathname || '',
						);
						parsed.search = pathnameParsed.search;
						parsed.hash = pathnameParsed.hash;

						pathname = url.format(parsed);
					}
				}
			}

			let normalized = '';

			try {
				normalized = normalizeURL(pathname, {
					removeTrailingSlash: false,
					sortQueryParameters: false,
					stripHash: false,
				});
			} catch (e) {}

			return normalized;
		},
		isURL(url: string): boolean {
			return validator.isURL(url, {
				protocols: ['http', 'https'],
				allow_underscores: true,
			});
		},
	},
};

export default helpers;
