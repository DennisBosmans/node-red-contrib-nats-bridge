module.exports = function(RED) {
    const http = require('http');
    const { connect, StringCodec } = require('nats');
    const fs = require('fs');

    function NatsBridgeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        node.natsUrl = config.natsUrl;
        node.credsFile = config.credsFile;
        node.httpPort = config.httpPort || 12345;

        let nc = null;
        const sc = StringCodec();
        const subscriptions = new Map();

        async function ensureNatsConnection() {
            if (!nc || !nc.connected) {
                try {
                    nc = await connect({
                        servers: node.natsUrl,
                        authenticator: nats.nkeyAuthenticator(new TextEncoder().encode(fs.readFileSync(node.credsFile, 'utf8'))),
                        reconnect: true,
                        maxReconnectAttempts: -1,
                        reconnectTimeWait: 1000,
                        timeout: 5000
                    });
                    node.log('Connected to NATS server');
                    
                    nc.closed()
                        .then((err) => {
                            node.log('NATS connection closed', err);
                            nc = null;
                        })
                        .catch((err) => {
                            node.error('Error on NATS connection close:', err);
                            nc = null;
                        });
                } catch (error) {
                    node.error('Failed to connect to NATS:', error);
                    return false;
                }
            }
            return true;
        }

        async function subscribeToTopic(topic) {
            if (!await ensureNatsConnection()) {
                throw new Error('NATS server unavailable');
            }

            if (subscriptions.has(topic)) {
                return; // Already subscribed
            }

            const subscription = nc.subscribe(topic);
            subscriptions.set(topic, subscription);

            (async () => {
                for await (const msg of subscription) {
                    const payload = sc.decode(msg.data);
                    node.send({topic: topic, payload: JSON.parse(payload)});
                }
            })().catch((err) => {
                node.error(`Subscription error for topic ${topic}:`, err);
                subscriptions.delete(topic);
            });
        }

        const server = http.createServer(async (req, res) => {
            if (req.socket.remoteAddress !== '::ffff:127.0.0.1' && req.socket.remoteAddress !== '127.0.0.1') {
                res.writeHead(403);
                res.end('Access denied');
                return;
            }

            if (req.method === 'GET') {
                const topic = req.url.slice(1); // Remove leading '/'
                if (!topic) {
                    res.writeHead(400);
                    res.end('Missing topic in URL');
                    return;
                }

                try {
                    await subscribeToTopic(topic);
                    res.writeHead(200);
                    res.end(`Subscribed to topic: ${topic}`);
                } catch (error) {
                    res.writeHead(503);
                    res.end('Failed to subscribe: ' + error.message);
                }
            } else if (req.method === 'POST' && req.url === '/') {
                const topic = req.headers['topic'];
                if (!topic) {
                    res.writeHead(400);
                    res.end('Missing "topic" header');
                    return;
                }

                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });

                req.on('end', async () => {
                    let payload;
                    try {
                        payload = JSON.parse(body);
                    } catch (error) {
                        res.writeHead(400);
                        res.end('Invalid JSON payload');
                        return;
                    }

                    if (!await ensureNatsConnection()) {
                        res.writeHead(503);
                        res.end('NATS server unavailable');
                        return;
                    }

                    try {
                        await nc.publish(topic, sc.encode(JSON.stringify(payload)));
                        res.writeHead(200);
                        res.end('Message published successfully');
                    } catch (error) {
                        node.error('Error publishing message:', error);
                        res.writeHead(500);
                        res.end('Error publishing message');
                    }
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        server.listen(node.httpPort, 'localhost', () => {
            node.log(`Server running at http://localhost:${node.httpPort}/`);
        });

        node.on('close', function(done) {
            server.close(() => {
                node.log('HTTP server closed');
                if (nc) {
                    nc.close().then(() => {
                        node.log('NATS connection closed');
                        done();
                    }).catch((err) => {
                        node.error('Error closing NATS connection:', err);
                        done();
                    });
                } else {
                    done();
                }
            });
        });

        // Ensure NATS connection on startup
        ensureNatsConnection();
    }

    RED.nodes.registerType("nats-bridge", NatsBridgeNode);
}
