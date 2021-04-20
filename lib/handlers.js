/**
 * Request Handlers
 */
const _data = require('./data');
const helpers = require('./helpers');

// Define the handlers
const handlers = {};

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

    const firstName = typeof(payload.firstName) == 'string' && payload.firstName.trim().length > 0 ? payload.firstName.trim() : false;
    const lastName = typeof(payload.lastName) == 'string' && payload.lastName.trim().length > 0 ? payload.lastName.trim() : false;
    const phone = typeof(payload.phone) == 'string' && payload.phone.trim().length == 10 ? payload.phone.trim() : false;
    const password = typeof(payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;
    const tosAgreement = typeof(payload.tosAgreement) == 'boolean' && payload.tosAgreement == true ? true : false;

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
                            callback(500, {'Error': 'Could not create the new user'});
                        }
                    });
                } else {
                    callback(500, {'Error': 'Could not hash the user\'s password'});
                }

            } else {
                callback(400, {'Error': 'A user with that phone number already exists'});
            }
        });

    } else {
        callback(400, {'Error': 'Missing required fields'});
    }
};

// Users - get
// Required data: phone
// Optional data: none
// @TODO  Only an authenticated user acess their object
handlers._users.get = (data, callback) => {
    const { phone } = data.queryStringObject;

    if (typeof(phone) == 'string' && phone.trim().length == 10) {
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
        callback(400, {'Error': 'Missing required field'});
    }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
// @TODO  Only an authenticated user can access their object
handlers._users.put = (data, callback) => {
    const { payload } = data;
    const { phone } = data.payload;

    if (typeof(phone) == 'string' && phone.trim().length == 10) {
        const firstName = typeof(payload.firstName) == 'string' && payload.firstName.trim().length > 0 ? payload.firstName.trim() : false;
        const lastName = typeof(payload.lastName) == 'string' && payload.lastName.trim().length > 0 ? payload.lastName.trim() : false;
        const password = typeof(payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;

        if (firstName || lastName || password) {
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
                            callback(500, {'Error': 'Could not update the user'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'The specified user does not exists'}); 
                }
            });
        } else {
            callback(400, {'Error': 'Missing fields to update'});
        }
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// Users - delete
// Required data: phone
// @TODO  Only an authenticated user can access their object
// @TODO Cleanup any other data files associated with this user
handlers._users.delete = (data, callback) => {
    const { phone } = data.queryStringObject;

    if (typeof(phone) == 'string' && phone.trim().length == 10) {
        _data.read('users', phone, (err, data) => {
            if (!err) {
                _data.delete('users', phone, (err) => {
                    if (!err) {
                        callback(200);
                    } else {
                        callback(404, {'Error': 'Could not delete the user'});
                    }
                });
            } else {
                callback(500, {'Error': 'Could not find the user'});
            }
        });
    } else {
        callback(400, {'Error': 'Could not find the user'});
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

    const phone = typeof(payload.phone) == 'string' && payload.phone.trim().length == 10 ? payload.phone.trim() : false;
    const password = typeof(payload.password) == 'string' && payload.password.trim().length > 0 ? payload.password.trim() : false;

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
                            callback(500, {'Error': 'Could not create token'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'Password did not match'});
                }
            } else {
                callback(400, {'Error': 'Could not find the specified user'});
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field(s)'});
    }
};

// Required data: id
handlers._tokens.get = (data, callback) => {
    const { id } = data.queryStringObject;

    if (typeof(id) == 'string' && id.trim().length == 20) {
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                callback(200, tokenData);
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error': 'Missing required field'});
    }
};

// Required data: id, extend
handlers._tokens.put = (data, callback) => {
    const { payload } = data;

    const id = typeof(payload.id) == 'string' && payload.id.trim().length == 20 ? payload.id.trim() : false;
    const extend = typeof(payload.extend) == 'boolean' && payload.extend == true ? true : false;

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
                            callback(500, {'Error': 'Could not update the token'});
                        }
                    });
                } else {
                    callback(400, {'Error': 'The token has already expired, and cannot be extend'}); 
                }
            } else {
                callback(400, {'Error': 'The specified token does not exist'}); 
            }
        });
    } else {
        callback(400, {'Error': 'Missing required fields or fields are invalid'});
    }
};

// Required data: id
handlers._tokens.delete = (data, callback) => {
    const { id } = data.queryStringObject;

    if (typeof(id) == 'string' && id.trim().length == 20) {
        _data.read('tokens', id, (err, data) => {
            if (!err) {
                _data.delete('tokens', id, (err) => {
                    if (!err) {
                        callback(200);
                    } else {
                        callback(500, {'Error': 'Could not delete the token'});
                    }
                });
            } else {
                callback(404, {'Error': 'Could not find the token'});
            }
        });
    } else {
        callback(400, {'Error': 'Could not find the token'});
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