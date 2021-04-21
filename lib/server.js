/**
 * Server-related tasks
 */
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const fs = require('fs');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog('server');

const server = {};

// Instantiate HTTP server
server.httpServer = http.createServer((req, res) => {
    server.unifiedServer(req, res);
});

// Instantiate HTTPS server
server.httpsServerOptions = {
    'key': fs.readFileSync(path.join(__dirname, '../https/key.pem')),
    'cert': fs.readFileSync(path.join(__dirname, '../https/cert.pem'))
};
server.httpsServer = https.createServer(server.httpsServerOptions, (req, res) => {
    server.unifiedServer(req, res);
}); 


server.unifiedServer = (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Get the path and removed / from the start and the end. /foo/bar/ => foo/bar
    const trimmedPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

    const queryStringObject = parsedUrl.query;
    
    const method = req.method.toLowerCase();

    const headers = req.headers;

    // Get the payload
    const decoder = new StringDecoder('utf-8');
    let buffer = '';

    //Streams
    req.on('data', (data) => {
        buffer += decoder.write(data);
    });
    req.on('end', () => {
        buffer += decoder.end();

        // Choose the handler this request should go to. If one is not found choose notfound
        const chooseHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        // Construct the data object to send to the handler
        const data = {
            'trimmedPath': trimmedPath,
            'queryStringObject': queryStringObject,
            'method': method,
            'headers': headers,
            'payload': helpers.parseJsonToObject(buffer)
        };

        // Route the request to the handler
        chooseHandler(data, (statusCode, payload) => {
            // Use the status code called back by the handler, or default to 200
            statusCode = typeof(statusCode) === 'number' ? statusCode : 200;

            // Use the payload called back by the handler, or default to empty
            payload = typeof(payload) == 'object' ? payload : {};

            // Convert the payload to a string
            const payloadString = JSON.stringify(payload);

            // Return the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            // If the response is 200, print green otherwise print red
            if (statusCode == 200) {
              debug('\x1b[32m%s\x1b[0m', `${method.toUpperCase()}/${trimmedPath} ${statusCode}`);
            } else {
              debug('\x1b[31m%s\x1b[0m', `${method.toUpperCase()}/${trimmedPath} ${statusCode}`);
            }
            debug('Returning this response: ', statusCode, payloadString);
        });
    });
}

// Define a request router
server.router = {
    'ping': handlers.ping,
    'users': handlers.users,
    'tokens': handlers.tokens,
    'checks': handlers.checks
}

server.init = () => {
  // Start the HTTP server
  server.httpServer.listen(config.httpPort, () => {
    console.log('\x1b[36m%s\x1b[0m', `The server is listening on port ${config.httpPort} in ${config.envName} mode`);
  });

  // Start the HTTPS server
  server.httpsServer.listen(config.httpsPort, () => {
    console.log('\x1b[35m%s\x1b[0m', `The server is listening on port ${config.httpsPort} in ${config.envName} mode`);
  });
};

module.exports = server;