'use strict'

var fs = require('fs');
var ipCalc = require('ip');

function Gateway(title) {
    this.company = 'unknown';
    this.title = title;
    this.isCustomer = 'no';
    this.isSupplier = 'no';
    this.ips = [];
    this.prefix = 'none';
    this.protocol = 'H.323';
}

Gateway.prototype = {
    set address(value) {
        if (value[value.length - 1] === ';') {
            value = value.slice(0, -1);
        }
        value.split(';')
            .forEach(ip => this.ips.push(ip));
    },

    get address() {
        let masks = new Map([
            ['255.255.255.255', '/32'],
            ['255.255.255.254', '/31'],
            ['255.255.255.252', '/30'],
            ['255.255.255.248', '/29'],
            ['255.255.255.240', '/28'],
            ['255.255.255.224', '/27'],
            ['255.255.255.192', '/26'],
            ['255.255.255.128', '/25'],
            ['255.255.255.0', '/24'],
            ['255.255.254.0', '/23'],
            ['255.255.252.0', '/22'],
            ['255.255.248.0', '/21'],
            ['255.255.240.0', '/20'],
            ['255.255.224.0', '/19'],
            ['255.255.192.0', '/18'],
            ['255.255.128.0', '/17'],
            ['255.255.0.0', '/16'],
            ['255.254.0.0', '/15'],
            ['255.252.0.0', '/14'],
            ['255.248.0.0', '/13'],
            ['255.240.0.0', '/12'],
            ['255.224.0.0', '/11'],
            ['255.192.0.0', '/10'],
            ['255.128.0.0', '/9'],
            ['255.0.0.0', '/8']]);
        return this.mask ? this.ips.map(ip => ip + masks.get(this.mask)).join(',') : this.ips.join(',');
    },

    set converter(value) {
        if (value === 'SIPconv') {
            this.protocol = 'SIP';
        }
    },

    set gateway_mode(value) {
        if (value === '1') {
            this.isCustomer = 'yes';
        } else if (value === '2') {
            this.isSupplier = 'yes';
        }
    },

    set dst_translate(value) {
        let regex = /\^\.\*\/(.*)&/i;
        let prefix = regex.exec(value);
        if (prefix) this.prefix = prefix[1];
    },

    set in_dst_translate(value) {
        let regex = /^(.*)\|.*/i;
        let prefix = regex.exec(value);
        if (prefix) this.prefix = prefix[1];
    },

    isValid() {
        return this.ips.length;
    },

    transform(companiesIPs) {
        if (!this.mask) this.ips = this.ips.filter(ip => companiesIPs.has(ip));
        this.company = this.mask ? companiesIPs.get(ipCalc.subnet(this.ips[0], this.mask).firstAddress) : companiesIPs.get(this.ips[0]);
        this.protocol = this.protocol === 'H.323' && this.isCustomer === 'yes' ? 'H.323/SIP' : this.protocol;
        this.ips.sort();
        if (this.group) {
            this.isCustomer = 'yes';
        } else {
            this.isSupplier = 'yes';
        }
        this.hash = this.ips + this.protocol + this.prefix + this.isCustomer + this.isSupplier;
    },

    toString() {
        return this.company + ';'
            + this.title + ';'
            + this.isCustomer + ';'
            + this.isSupplier + ';'
            + this.address + ';'
            + this.protocol + ';'
            + this.prefix + ';';
    }
}

const GATEWAY_FILE_157 = './files/157.cfg';
const GATEWAY_FILE_156 = './files/156.cfg';
const GATEWAY_FILE_158 = './files/158.cfg';
const GATEWAY_FILE_150 = './files/150.cfg';
const GATEWAY_FILE_152 = './files/152.cfg';
const GATEWAY_FILE_151 = './files/151.cfg';
const IP_FILE = './files/ips.csv';

try {
    let gw157 = fs.readFileSync(GATEWAY_FILE_157, 'utf8');
    let gw156 = fs.readFileSync(GATEWAY_FILE_156, 'utf8');
    let gw158 = fs.readFileSync(GATEWAY_FILE_158, 'utf8');
    let gw150 = fs.readFileSync(GATEWAY_FILE_150, 'utf8');
    let gw152 = fs.readFileSync(GATEWAY_FILE_152, 'utf8');
    let gw151 = fs.readFileSync(GATEWAY_FILE_151, 'utf8');
    var gatewayCfgContent = gw157 + gw156 + gw158 + gw150 + gw152 + gw151;
    var ipsContent = fs.readFileSync(IP_FILE, 'utf8');
} catch (err) {
    console.log(err.message);
}

let companiesIPs = getIPs(ipsContent);
let gateways = getGateways(gatewayCfgContent);

let gatewaysGroupedByCompany = gateways.reduce((gatewaysGroupedByCompany, gateway) => {
    if (gatewaysGroupedByCompany.has(gateway.company)) {
        gatewaysGroupedByCompany.get(gateway.company).push(gateway);
    } else {
        gatewaysGroupedByCompany.set(gateway.company, [gateway]);
    }
    return gatewaysGroupedByCompany;
}, new Map());

var output = ['Company;Gateway Name;isCustomer;isSupplier;IPs;Protocol;Prefix'];
for (let gatewayGroup of gatewaysGroupedByCompany.values()) {
    gatewayGroup.forEach(gateway => {
        let gatewayAsString = gateway.toString();
        output.push(gatewayAsString);
    });
}

fs.writeFileSync('./files/out/output.csv', output.join('\n'), 'utf8');
console.dir(output);
console.log('done');

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
            let currentGateway = gateways[gateways.length - 1];
            if (line[0] === '[') {
                if (currentGateway) {
                    currentGateway.transform(companiesIPs);
                    let isDuplicate = gateways.filter(gateway => gateway.hash === currentGateway.hash).length > 1;
                    if (!currentGateway.isValid() || isDuplicate) gateways.pop();
                };
                let gatewayTitle = line.slice(1, -1);
                gateways.push(new Gateway(gatewayTitle));
            } else {
                let [option, value] = line.split('=');
                currentGateway[option] = value.trim();
            }
            return gateways;
        }, []);
}