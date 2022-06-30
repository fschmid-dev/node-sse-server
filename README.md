# node-sse-server

node-sse-server is a simple Node.js + Express.js server app, that provides SSE ([server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)) functionality. It's written to provide a possibility to use the symfony/ux-turbo-mercure bundle in symfony without having to set up a mercure server.

## Installation

1. Clone the project
2. Install dependencies

Yarn:
```bash
yarn install
```
NPM:
```bash
npm install
```
3. Edit configuration

```javascript
// Define server ports
const HTTP_PORT = 8080;
const HTTPS_PORT = 8443;
```

4. (optional) Setup HTTPS

Change paths to your key.pem and cert.pem file
```javascript
// Check if certificate files exist
if (fs.existsSync(__dirname + '/key.pem') && fs.existsSync(__dirname + '/cert.pem')) {
    const options = {
        key: fs.readFileSync(__dirname + '/key.pem'),
        cert: fs.readFileSync(__dirname + '/cert.pem')
    };
    // Start HTTPS server, listen for HTTPS_PORT
    const httpsServer = https.createServer(options, app);
    httpsServer.listen(HTTPS_PORT, () => {
        console.log('HTTPS Server starting on port: ' + HTTPS_PORT);
    });
}
```

## Usage

In your symfony project, after installing the mercure bundle and installing the provided recipes, you have two new environment variables in your .env file.

Change the variables to match your host and port.

```bash
# The URL of the Mercure hub, used by the app to publish updates (can be a local URL)
MERCURE_URL=http://localhost:8080/publish
# The public URL of the Mercure hub, used by the browser to connect
MERCURE_PUBLIC_URL=http://localhost:8080/events
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
