const _ = require('lodash');
const pLimit = require('p-limit');
const validator = require('validator');
const normalizeURL = require('normalize-url');
const url = require('url');
const path = require('path');

const helpers = {
	id: (entry) => (entry && typeof entry == 'object' && entry._id ? entry._id : entry),
	equals: (id1, id2) => String(helpers.id(id1)) == String(helpers.id(id2)),
	ciQuery: (value, loose) =>
		new RegExp(
			(loose ? '' : '^') + _.escapeRegExp((value || '').toLowerCase()) + (loose ? '' : '$'),
			'i',
		),
	cursorEachAsyncLimit: async (concurrentLimit, cursor, eachCallback) => {
		const limit = pLimit(concurrentLimit);

		await cursor.eachAsync((entry) => {
			limit((entry) => eachCallback(entry), entry);
		});

		while (limit.pendingCount + limit.activeCount) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	},
	validation: {
		isEmail (email) {
			if (!email) {
				return false;
			}

			return validator.isEmail(email);
		},
		formatEmail (email) {
			if (!email) {
				return null;
			}

			return String(email).toLowerCase();
		},
		isUsername (username, type) {
			//Instagram: 30, Twitter: 15, Tumblr: 32, Facebook: 50

			if (!username) {
				return false;
			}

			if (type == 'instagram') {
				return /^[a-zA-Z0-9_]{1,30}$/.test(username);
			} else if (type == 'twitter') {
				return /^[a-zA-Z0-9_]{1,15}$/.test(username);
			}

			return false;
		},
		formatUsername (username /*, type*/) {
			if (!username) {
				return null;
			}

			return String(String(username).split('@').join('').split(' ')[0]).toLowerCase();
		},
		formatURL (baseURL, pathname) {
			if (arguments.length === 1) {
				pathname = baseURL;
				baseURL = null;
			}

			//Do not format base64 img urls
			if (pathname.indexOf(';base64,') !== -1) {
				return pathname;
			}

			if (baseURL) {
				if (pathname.indexOf('://') == -1 || pathname.indexOf('://') > 5) {
					const parsed = url.parse(baseURL);

					if (parsed.host) {
						const pathnameParsed = url.parse(pathname);

						parsed.protocol = parsed.protocol || 'http';
						parsed.pathname = path.join(parsed.pathname, pathnameParsed.pathname);
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
					stripHash: false
				});
			} catch (e) {}

			return normalized;
		},
		isURL (url) {
			return validator.isURL(url, {
				protocols: ['http', 'https'],
				allow_underscores: true,
			});
		},
	},
};

module.exports = helpers;
