/**
 *  Helpers for various tasks
*/
const crypto = require('crypto');
const config = require('./config');

const helpers = {};

helpers.hash = (str) => {
    if (typeof(str) == 'string' && str.length > 0) {
        const hash = crypto
            .createHmac('sha256', config.hashingSecret)
            .update(str)
            .digest('hex');

        return hash;
    } else {
        return false;
    }
};

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
    try {
        const obj = JSON.parse(str);
        return obj;
    } catch (err) {
        return {};
    }
};

// Create random string
helpers.createRandomString = (strLength) => {
    if (typeof(strLength) == 'number' && strLength > 0) {
        const possibleCharacters = 'abcdefghijlmopqrstuvwxyz0123456789';

        let str = '';
        for (i = 1; i <= strLength; i++) {
            let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            str += randomCharacter;
        }

        return str;
    } else {
        return false;
    }
};

module.exports = helpers;