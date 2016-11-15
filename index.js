#!/usr/bin/env node
'use strict';

const _ = require('lodash');
const net = require('net');
const tls = require('tls');
const EventEmitter = require('events');
const parseArgs = require('minimist');
const Throttle = require('throttle');

const argv = parseArgs(process.argv.slice(2));

class TcpProxy extends EventEmitter {
    constructor() {
        super();
    }

    proxy(origin, options) {
        const kbps = options.kbps || 56;
        this.originSock = origin;

        options.target = options.target || this.target;

        if (options.ssl) {
            this.targetSock = tls.connect(options.ssl, options.target);
        } else {
            this.targetSock = net.connect(options.target);
        }

        this.targetSock.on('error', this.emit.bind(this, 'error'));
        this.originSock.on('error', this.emit.bind(this, 'error'));

        this.slowDown = new Throttle(kbps * 1024);

        this.targetSock.pipe(this.originSock).pipe(this.slowDown).pipe(this.targetSock);
    }
}

function createServer(options) {
    let server;

    const proxy = new TcpProxy();

    const requestHandler = (socket) => {
        proxy.proxy(socket, options);
    };

    if(options.ssl) {
        server = tls.createServer(options.ssl, requestHandler);
    } else {
        server = net.createServer(requestHandler);
    }

    proxy.on('error', server.emit.bind(server, 'error'));

    server.listen(options.port);
}

createServer(argv);
