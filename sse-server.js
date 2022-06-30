// Require necessary libraries
const cors = require('cors');
const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

// Load config file
if (!fs.existsSync('./config/config.json')) {
    console.info('./config/config.json not found!');
    console.info('copy ./config/config.json-dist to ./config/config.json and set your own values!');
    process.exit();
}
const config = require('./config/config.json');

// Setup express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));

// Start HTTP server, listen for HTTP_PORT
const httpServer = http.createServer(app);
httpServer.listen(
    config.server.http.port,
    config.server.http.host,
    () => {
        console.log(`HTTP Server listening on ${config.server.http.host}:${config.server.http.port}`);
    }
);

// Check if certificate files exist
if (fs.existsSync(__dirname + '/key.pem') && fs.existsSync(__dirname + '/cert.pem')) {
    const options = {
        key: fs.readFileSync(`${__dirname}/key.pem`),
        cert: fs.readFileSync(`${__dirname}/cert.pem`)
    };
    // Start HTTPS server, listen for HTTPS_PORT
    const httpsServer = https.createServer(options, app);
    httpsServer.listen(
        config.server.https.port,
        config.server.https.host,
        () => {
            console.log(`HTTPS Server listening on ${config.server.https.host}:${config.server.https.port}`);
        }
    );
}

// Save list of clients, useful for sendAll events
let clients = [];
// Save list of topics, useful for sendAllByTopic events
let topics = {};

// Simple status endpoint, to show total client count and client count per topic
app.get('/status', (request, response) => {
    const topicList = {};
    Object.keys(topics).forEach(topic => {
        topicList[topic] = {
            clientCount: topics[topic].clients.length
        }
    });

    response.json({
        clients: clients.length,
        topics: topicList,
    });
});

// Check for jwt token on every request
//  if provided, verify token is valid
app.use(function (req, res, next) {
    const bearerHeader = req.headers['authorization'];
    // If authorization header is provided
    if (typeof bearerHeader !== 'undefined') {
        // then get the token from it
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];

        try {
            // If token is invalid, an error will be thrown
            req.token = jwt.verify(bearerToken, '!ChangeMe!', {}, null);
            // TODO: move secret to some config file?
        } catch (e) {
            // Invalid token, end request
            console.error('Invalid token');
            console.error(e);
            res.send('invalid token!');
            return;
        }
    }

    // No token provided (e.g. /status or /events) or token is valid, continue the request
    next();
});

// /events endpoint, this will send the updates to the clients
app.get('/events', (request, response) => {
    // Set specific headers, to esablish a keep-alive event-stream connection
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
    }
    response.writeHead(200, headers);

    // "Generate" clientId
    const clientId = Date.now();

    // Create new client object with the open response object inside it
    const newClient = {
        id: clientId,
        response
    };

    // Check if topic param is provided
    //  should be provided with every request, but for now it's not mandatory
    const topic = request.query.topic;
    if (topic) {
        // Add topic to client
        newClient.topic = topic;

        if (topics.hasOwnProperty(topic)) {
            // If topic already exists, save client to subscribed list
            topics[topic].clients.push(newClient);
        } else {
            // If topic is new, add it to saved list with the client
            topics[topic] = {
                clients: [newClient]
            };
        }
    }

    // Add new client object to client list
    clients.push(newClient);

    // Handle connection close events
    request.on('close', () => {
        // Remove client from client list
        clients = clients.filter(client => client.id !== clientId);
        // Also remove the client from the topic list
        topics[topic].clients = topics[topic].clients.filter(client => client.id !== clientId);
    })
});

// /publish endpoint, clients will send POST requests with the topic and data inside the body
app.post('/publish', (req, res) => {
    const body = req.body;

    // Get topic and message data
    const topic = body.topic;
    const data = body.data;

    // TODO: add check if is allowed to publish to topic
    //  Only allow the publish, if the topic is provided inside the jwt token
    //  or it's allowed to publish to everything ('*')
    //  const token = req.token; // { mercure: { publish: [ '*' ], subscribe: [] } }
    //  const token = req.token; // { mercure: { publish: [ 'test_1', 'test_3' ], subscribe: [] } }

    // Normalize message, so it can be read by hotwire turbo again (single line)
    const message = normalizeMessage(data);

    // Close/end the request
    //  at first I had a problem, that the POST request wouldn't end and keep running until the client throws a timeout error
    //  manually ending the response helped with this issue
    res.end();

    // If the body does provide a topic (publish updates which are generated by mercure bundle in symfony always do)
    //  only send the update message to the clients, that are subscribed/that listen to that topic
    if (topic) {
        return sendToAllByTopic(topic, message);
    }

    // If no topic is provided, send the message to all clients for now
    // TODO: maybe throw an error later, because this shouldn't happen?
    return sendToAll(message);
});

// Function to normalize the messages before sending them
function normalizeMessage(msg) {
    // First replace:
    //  remove all line breaks from message (mandatory)
    // Second replace:
    //  remove whitespaces between > and < to reduce message size (optional)
    //  surly can be further improved
    return msg.replace(/(\r\n|\n|\r)/gm, '').replace(/>\s+</g, '><');
}

// Send message to all clients, that are currently connected
function sendToAll(msg) {
    clients.forEach(client => {
        sendMsg(client.response, msg);
    });
}

// Send message to all clients, that are subscribed/that listen to a specific topic
function sendToAllByTopic(topic, msg) {
    topics[topic].clients.forEach(client => {
        sendMsg(client.response, msg);
    });
}

// Send the message to the response in SSE-Format
//  data: <message>\n\n
//  the two line breaks at the end are necessary to distinguish between the messages
function sendMsg(response, msg) {
    response.write(`data: ${msg}\n\n`);
}
