'use strict'

var fs = require('fs');
var ipCalc = require('ip');

function Gateway(title) {
    this.title = title;
    this.ips = new Set();
    this.prefix = 'none';
    this.protocol = 'H.323';
}

Gateway.prototype = {
    set address(value) {
        if (value[value.length - 1] === ';') {
            value = value.slice(0, -1);
        }
        value.split(';')
            .forEach(ip => this.ips.add(ip));
    },

    get address() {
        let [...ips] = this.ips;
        return ips;
    },

    set converter(value) {
        if (value === 'SIPconv') {
            this.protocol = 'SIP';
        }
    },

    set gateway_mode(value) {
        this.direction = value == 1 ? 'customer' : 'supplier';
    },

    set dst_translate(value) {
        let regex = /\^\.\*\/(.*)&/i;
        let prefix = regex.exec(value);
        if (prefix) this.prefix = prefix[1];
    },

    toString() {
        return this.company + ';'
            + this.title + ';'
            + this.direction + ';'
            + this.address + ';'
            + this.protocol + ';'
            + this.prefix + ';';
    }
}

const GATEWAY_FILE = './files/gateway.cfg';
const IP_FILE = './files/ips.csv';

try {
    var gatewayCfgContent = fs.readFileSync(GATEWAY_FILE, 'utf8');
    var ipsContent = fs.readFileSync(IP_FILE, 'utf8');
} catch (err) {
    console.log(err.message);
}

let companiesIPs = getIPs(ipsContent);
let gateways = getGateways(gatewayCfgContent);

gateways.forEach(gateway => {

    ////////////////////////////////////////////////////////////<<<<<<============

    let firstIp = gateway.ips.values().next().value;
    if (companiesIPs.has(firstIp)) {
        gateway.company = companiesIPs.get(firstIp);
    } else {
        gateway.company = 'unknown';
    }
});

let gatewaysGroupedByCompany = gateways.reduce((gatewaysGroupedByCompany, gateway) => {
    if (gatewaysGroupedByCompany.has(gateway.company)) {
        gatewaysGroupedByCompany.get(gateway.company).push(gateway);
    } else {
        gatewaysGroupedByCompany.set(gateway.company, [gateway]);
    }
    return gatewaysGroupedByCompany;
}, new Map());

var output = ['Company;Gateway Name;Direction;IPs;Protocol;Prefix'];
for (let gatewayGroup of gatewaysGroupedByCompany.values()) {
    gatewayGroup.forEach(gateway => {
        if (gateway.company !== 'unknown') {
            let gatewayAsString = gateway.toString();
            output.push(gatewayAsString);
        }
    });
}

console.dir(output);

function getIPs(ipsContent) {
    return new Map(ipsContent
        .trim()
        .split('\r\n')
        .map(line => line.split(';')));
}

function getGateways(gatewayCfgContent) {
    return gatewayCfgContent
        .trim()
        .split('\n')
        .filter(function isNotCommentOrEmptyLineOrEmptyOption(line) {
            return line[0] !== '#' &&
                line.trim() !== '' &&
                line[line.length - 1] !== '=';
        })
        .reduce((gateways, line) => {
            if (line[0] === '[') {
                let gatewayTitle = line.slice(1, -1);
                gateways.push(new Gateway(gatewayTitle));
            } else {
                let [option, value] = line.split('=');
                let lastGatewayInCollection = gateways[gateways.length - 1];
                lastGatewayInCollection[option] = value.trim();
            }
            return gateways;
        }, []);
}