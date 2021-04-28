/**
 * Request Handlers
 */
const config = require('./config');
const _data = require('./data');
const helpers = require('./helpers');

// Define the handlers
const handlers = {};

/**
 * HTML Handlers
 */
handlers.index = (data, callback) => {
  // Reject any request that ins't a GET
  if (data.method == 'get') {
    // Read in a template as a string
    helpers.getTemplate('index', (err, str) => {
      if (!err && str) {
        callback(200, str, 'html');
      } else {
        callback(500, undefined, 'html');
      }
    });
  } else {  
    callback(405, undefined, 'html');
  }
};

/** 
 * JSON API Handlers
*/
// User
handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the user submethods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  const { payload } = data;

  const firstName = typeof (payload.firstName) == 'string' && payload.firstName.trim().length > 0 ? payload.firstName.trim() : false;
  const lastName = typeof (payload.lastName) == 'string' && payload.lastName.trim().length > 0 ? payload.lastName.trim() : false;
  const phone = typeof (payload.phone) == 'string' && payload.phone.trim().length == 10 ? payload.phone.trim() : false;
  const password = typeof (payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;
  const tosAgreement = typeof (payload.tosAgreement) == 'boolean' && payload.tosAgreement == true ? true : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    _data.read('users', phone, (err, data) => {
      if (err) {
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          const user = {
            'firstName': firstName,
            'lastName': lastName,
            'phone': phone,
            'hashedPassword': hashedPassword,
            'tosAgreement': tosAgreement
          };

          _data.create('users', phone, user, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { 'Error': 'Could not create the new user' });
            }
          });
        } else {
          callback(500, { 'Error': 'Could not hash the user\'s password' });
        }

      } else {
        callback(400, { 'Error': 'A user with that phone number already exists' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
};

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  const { phone } = data.queryStringObject;

  if (typeof (phone) == 'string' && phone.trim().length == 10) {
    // Get the token from the headers
    const { token } = data.headers;

    handlers._tokens.veriyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        _data.read('users', phone, (err, data) => {
          if (!err && data) {
            // Remove the hashed password before returning it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data, callback) => {
  const { payload } = data;
  const { phone } = data.payload;

  if (typeof (phone) == 'string' && phone.trim().length == 10) {
    const firstName = typeof (payload.firstName) == 'string' && payload.firstName.trim().length > 0 ? payload.firstName.trim() : false;
    const lastName = typeof (payload.lastName) == 'string' && payload.lastName.trim().length > 0 ? payload.lastName.trim() : false;
    const password = typeof (payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;

    if (firstName || lastName || password) {

      // Get the token from the headers
      const { token } = data.headers;

      handlers._tokens.veriyToken(token, phone, (tokenIsValid) => {
        if (tokenIsValid) {
          _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
              if (firstName) {
                userData.firstName = firstName;
              }
              if (lastName) {
                userData.lastName = lastName;
              }
              if (password) {
                userData.password = helpers.hash(password);
              }

              _data.update('users', phone, userData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { 'Error': 'Could not update the user' });
                }
              });
            } else {
              callback(400, { 'Error': 'The specified user does not exists' });
            }
          });
        } else {
          callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
        }
      });
    } else {
      callback(400, { 'Error': 'Missing fields to update' });
    }
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

// Users - delete
// Required data: phone
handlers._users.delete = (data, callback) => {
  const { phone } = data.queryStringObject;

  if (typeof (phone) == 'string' && phone.trim().length == 10) {

    // Get the token from the headers
    const { token } = data.headers;

    handlers._tokens.veriyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        _data.read('users', phone, (err, userData) => {
          if (!err) {
            _data.delete('users', phone, (err) => {
              if (!err) {
                // Delete each of the checks associated with the user
                const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                const checksToDelete = userChecks.length;
                if (checksToDelete > 0) {
                  let checksDeleted = 0;
                  let deletionErrors = false;

                  userChecks.forEach((checkId) => {
                    _data.delete('checks', checkId, (err) => {
                      if (err) {
                        deletionErrors = true;
                      }

                      checksDeleted++;
                      if (checksDeleted == checksDeleted) {
                        if (!deletionErrors) {
                          callback(200);
                        } else {
                          callback(500, { 'Error': 'Errors encountered while attemping to delete all of the users checks. All checks may not have been deleted' });
                        }
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(404, { 'Error': 'Could not delete the user' });
              }
            });
          } else {
            callback(500, { 'Error': 'Could not find the user' });
          }
        });
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });
  } else {
    callback(400, { 'Error': 'Could not find the user' });
  }
};

// Tokens
handlers.tokens = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for all the tokens methods
handlers._tokens = {};

// Required data: Phone, password
handlers._tokens.post = (data, callback) => {
  const { payload } = data;

  const phone = typeof (payload.phone) == 'string' && payload.phone.trim().length == 10 ? payload.phone.trim() : false;
  const password = typeof (payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;

  if (phone && password) {
    _data.read('users', phone, (err, userData) => {
      if (!err) {
        const hashedPassword = helpers.hash(password);

        if (hashedPassword === userData.hashedPassword) {
          // if valid, create new token with a random name. Set expiration date 1 hour in the future
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            'phone': phone,
            'id': tokenId,
            'expires': expires
          };

          // Store the token
          _data.create('tokens', tokenId, tokenObject, (err) => {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { 'Error': 'Could not create token' });
            }
          });
        } else {
          callback(400, { 'Error': 'Password did not match' });
        }
      } else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field(s)' });
  }
};

// Required data: id
handlers._tokens.get = (data, callback) => {
  const { id } = data.queryStringObject;

  if (typeof (id) == 'string' && id.trim().length == 20) {
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

// Required data: id, extend
handlers._tokens.put = (data, callback) => {
  const { payload } = data;

  const id = typeof (payload.id) == 'string' && payload.id.trim().length == 20 ? payload.id.trim() : false;
  const extend = typeof (payload.extend) == 'boolean' && payload.extend == true ? true : false;

  if (id && extend) {
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        // check to make sure the token isn't already expired
        if (tokenData.expires > Date.now()) {
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          _data.update('tokens', id, tokenData, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { 'Error': 'Could not update the token' });
            }
          });
        } else {
          callback(400, { 'Error': 'The token has already expired, and cannot be extend' });
        }
      } else {
        callback(400, { 'Error': 'The specified token does not exist' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required fields or fields are invalid' });
  }
};

// Required data: id
handlers._tokens.delete = (data, callback) => {
  const { id } = data.queryStringObject;

  if (typeof (id) == 'string' && id.trim().length == 20) {
    _data.read('tokens', id, (err, data) => {
      if (!err) {
        _data.delete('tokens', id, (err) => {
          if (!err) {
            callback(200);
          } else {
            callback(500, { 'Error': 'Could not delete the token' });
          }
        });
      } else {
        callback(404, { 'Error': 'Could not find the token' });
      }
    });
  } else {
    callback(400, { 'Error': 'Could not find the token' });
  }
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.veriyToken = (id, phone, callback) => {
  _data.read('tokens', id, (err, tokenData) => {
    if (!err && tokenData) {
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// Checks
handlers.checks = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

//Container for all the checks methods
handlers._checks = {};

// Required data: protocol, url, method, successCodes, timeoutSeconds
handlers._checks.post = (data, callback) => {
  const { payload } = data;

  const protocol = typeof (payload.protocol) == 'string' && ['https', 'http'].indexOf(payload.protocol) > -1 ? payload.protocol : false;
  const url = typeof (payload.url) == 'string' && payload.url.trim().length > 0 ? payload.url.trim() : false;
  const method = typeof (payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(payload.method) > -1 ? payload.method : false;
  const successCodes = typeof (payload.successCodes) == 'object' && payload.successCodes instanceof Array && payload.successCodes.length > 0 ? payload.successCodes : false;
  const timeoutSeconds = typeof (payload.timeoutSeconds) == 'number' && payload.timeoutSeconds % 1 === 0 && payload.timeoutSeconds >= 1 && payload.timeoutSeconds <= 5 ? payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    const { token } = data.headers;

    _data.read('tokens', token, (err, tokenData) => {
      if (!err && tokenData) {
        const userPhone = tokenData.phone;

        _data.read('users', userPhone, (err, userData) => {
          if (!err && userData) {
            const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

            // Verify that the user has less than the nunber of max-checks-per-user
            if (userChecks.length < config.maxChecks) {
              const checkId = helpers.createRandomString(20);

              const checkObject = {
                'id': checkId,
                'userPhone': userPhone,
                'protocol': protocol,
                'url': url,
                'method': method,
                'successCodes': successCodes,
                'timeoutSeconds': timeoutSeconds
              };

              _data.create('checks', checkId, checkObject, (err) => {
                if (!err) {
                  // Add the check id to the users object
                  userData.checks = userChecks;
                  userData.checks.push(checkId);

                  _data.update('users', userPhone, userData, (err) => {
                    if (!err) {
                      callback(200, checkObject);
                    } else {
                      callback(500, { 'Error': 'Could not update the user with the new check' });
                    }
                  });
                } else {
                  callback(500, { 'Error': 'Could not create the new check' });
                }
              })

            } else {
              callback(400, { 'Error': `The user already has the maximum number of checks (${config.maxChecks})` });
            }
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, { 'Error': 'Missing inputs, or inputs are invalid' });
  }
};

// Required data: id
handlers._checks.get = (data, callback) => {
  const { id } = data.queryStringObject;

  if (typeof (id) == 'string' && id.trim().length == 20) {

    _data.read('checks', id, (err, checkData) => {
      if (!err) {
        // Get the token from the headers
        const { token } = data.headers;

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.veriyToken(token, checkData.userPhone, (tokenIsValid) => {
          if (tokenIsValid) {
            callback(200, checkData);
          } else {
            callback(403);
          }
        });
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};

// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = (data, callback) => {
  const { payload } = data;
  const { id } = payload;

  if (typeof (id) == 'string' && id.trim().length == 20) {
    const protocol = typeof (payload.protocol) == 'string' && ['https', 'http'].indexOf(payload.protocol) > -1 ? payload.protocol : false;
    const url = typeof (payload.url) == 'string' && payload.url.trim().length > 0 ? payload.url.trim() : false;
    const method = typeof (payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(payload.method) > -1 ? payload.method : false;
    const successCodes = typeof (payload.successCodes) == 'object' && payload.successCodes instanceof Array && payload.successCodes.length > 0 ? payload.successCodes : false;
    const timeoutSeconds = typeof (payload.timeoutSeconds) == 'number' && payload.timeoutSeconds % 1 === 0 && payload.timeoutSeconds >= 1 && payload.timeoutSeconds <= 5 ? payload.timeoutSeconds : false;

    if (protocol || url || method || successCodes || timeoutSeconds) {

      _data.read('checks', id, (err, checkData) => {
        if (!err) {
          // Get the token from the headers
          const { token } = data.headers;

          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.veriyToken(token, checkData.userPhone, (tokenIsValid) => {
            if (tokenIsValid) {
              // Update the check where necessary

              if (protocol) {
                checkData.protocol = protocol;
              }
              if (url) {
                checkData.url = url;
              }
              if (method) {
                checkData.method = method;
              }
              if (successCodes) {
                checkData.successCodes = successCodes;
              }
              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }

              _data.update('checks', id, checkData, (err) => {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, { 'Error': 'Could not update check' });
                }
              });
            } else {
              callback(403);
            }
          });
        } else {
          callback(400, { 'Error': 'Check ID did not exists' });
        }
      });

    } else {
      callback(400, { 'Error': 'Missing fields to update' });
    }
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
};


// Required data: id
handlers._checks.delete = (data, callback) => {
  const { id } = data.queryStringObject;

  if (typeof (id) == 'string' && id.trim().length == 20) {
    _data.read('checks', id, (err, checkData) => {
      if (!err && checkData) {

        // Get the token from the headers
        const { token } = data.headers;

        handlers._tokens.veriyToken(token, checkData.userPhone, (tokenIsValid) => {
          if (tokenIsValid) {

            // Delete the check data
            _data.delete('checks', id, (err) => {
              if (!err) {
                _data.read('users', checkData.userPhone, (err, userData) => {
                  if (!err && userData) {
                    const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                    //Remove the deleted check from their list of checks
                    const checkPosition = userChecks.indexOf(id);
                    if (checkPosition > -1) {
                      userChecks.splice(checkPosition, 1);

                      _data.update('users', checkData.userPhone, userData, (err) => {
                        if (!err) {
                          callback(200);
                        } else {
                          callback(500, { 'Error': 'Could not update the specified user' });
                        }
                      });
                    } else {
                      callback(500, { 'Error': 'Could not the check on the users object and cannot remove it' });
                    }
                  } else {
                    callback(500, { 'Error': 'Could not find the user who created the check' });
                  }
                });
              } else {
                callback(500, { 'Error': 'Could not delete the check data' });
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(400, { 'Error': 'The specified check ID does not exist' });
      }
    });
  } else {
    callback(400, { 'Error': 'Could not find the check' });
  }
};

// Ping handler
handlers.ping = (data, callback) => {
  callback(200);
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

module.exports = handlers;