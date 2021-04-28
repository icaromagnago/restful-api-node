/**
 *  Helpers for various tasks
*/
const crypto = require('crypto');
const config = require('./config');
const https = require('https');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');

const helpers = {};

helpers.hash = (str) => {
  if (typeof (str) == 'string' && str.length > 0) {
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
  if (typeof (strLength) == 'number' && strLength > 0) {
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

// Send an SMS message via TWilio
helpers.sendTwilioSms = (phone, msg, callback) => {
  //phone = typeof (phone) == 'string' && phone.trim().length == 11 ? phone.trim() : false;
  msg = typeof (msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;

  if (phone && msg) {
    const payload = {
      'From': config.twilio.fromPhone,
      'To': '+1'+phone,
      'Body': msg
    };

    const stringPayload = querystring.stringify(payload);

    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.twilio.com',
      'method': 'POST',
      'path': `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      'auth': `${config.twilio.accountSid}:${config.twilio.authToken}`,
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    const req = https.request(requestDetails, (res) => {
      const status = res.statusCode;
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback(`Status code returned was ${status}`);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', (err) => {
      callback(err);
    });

    // Add the payload
    req.write(stringPayload);

    // Send the request
    req.end();

  } else {
    callback('Given parameters were missing or invalid');
  }
};

// Get the string content of a template
helpers.getTemplate = (templateName, callback) => {
  templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
  if (templateName) {
    const templateDir = path.join(__dirname, '../templates/');
    fs.readFile(`${templateDir}${templateName}.html`, 'utf-8', (err, str) => {
      if (!err && str && str.length > 0) {
        callback(false, str);
      } else {
        callback('No template could be found');
      }
    });
  } else {
    callback('A valid template name was not specified');
  }
};
module.exports = helpers;