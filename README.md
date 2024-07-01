# node-red-contrib-nats-bridge
Node red node to sub and pub to nats server with .creds file

# Node-RED NATS Bridge

A Node-RED node that bridges HTTP and NATS, allowing you to publish and subscribe to NATS topics via HTTP requests.

## Features

- Publish to NATS topics using HTTP POST requests
- Subscribe to NATS topics using HTTP GET requests
- Forward subscribed NATS messages to Node-RED flows
- Secure communication (only accepts localhost connections)
- Configurable NATS server URL and credentials
- Customizable HTTP port

## Installation

You can install this node directly from the Node-RED Palette Manager, or run the following command in your Node-RED user directory (typically `~/.node-red`):

This README provides:

1. An overview of the node's functionality
2. Installation instructions
3. Usage guidelines, including node configuration and how to publish/subscribe
4. Examples of how to use the node
5. Security considerations
6. Troubleshooting tips
7. Information on how to contribute
8. License information
9. Support details
