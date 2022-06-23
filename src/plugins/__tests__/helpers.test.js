const testMemoryServer = require('../__tests_utils__/testMemoryServer');
const helpers = require('../../helpers');

jest.setTimeout(30000);

let mongoose;

describe('formatURL', () => {
    beforeEach(async () => {
        jest.resetModules();
        mongoose = await testMemoryServer.createMongoose();
    });

    afterEach(async () => {
        await mongoose.disconnect();
    });

    it('should not encode asset URL', () => {
        const domainUrl = 'https://madebysix.com/project/kinfolk';
        const assetUrl = 'https://six.imgix.net/https%3A%2F%2Fimages.prismic.io%2Fsix-page%2F9643b029-1f7d-4888-a2cc-50f23fd4a27d_Kinfolk_08%25402x.png%3Fauto%3Dcompress%2Cformat?w=2560&h=1472&fit=crop&auto=compress%2Cformat&crop=undefined&q=90&ixlib=js-1.4.1&s=74fcf8fb935e7fdf3f3a9d38354c9c5a';
        const assetUrlObject = new URL(assetUrl);

       expect(helpers.validation.formatURL(domainUrl, assetUrl)).toEqual(assetUrlObject.toString());
    })
});
