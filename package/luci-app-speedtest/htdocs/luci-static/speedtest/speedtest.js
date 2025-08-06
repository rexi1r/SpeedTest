// Get all dropdown menus
const availableDropdowns = {
    starlink: 'starlink-interface',
    iran: 'iran-interface',
    vpn: 'vpn-interface',
    guest: 'guest-wifi-interface'
};

var availableInterfaces = [];

function loadNetworkInterfaces() {
    L.uci.load("network").then(function() {
        // Get all sections of type 'interface'
        const interfaces = L.uci.sections("network", "interface");
        availableInterfaces = [];
        // Populate dropdowns with interface information
        interfaces.forEach(function(interface) {
            if (interface['.name'] != 'loopback') {
                const name = interface['.name'];
                const proto = interface['proto'] || 'unknown';
                const ipaddr = interface['ipaddr'] || 'N/A';
                availableInterfaces.push({
                    name: name,
                    proto: proto,
                    ipaddr: ipaddr
                });
            }        
        });

    }).catch(function(error) {
        console.error("Error loading network config:", error);
    });
}


function getNetworkInterfaces() {
    return callUbus('network.interface', 'dump')
        .then(response => {
            if (response.status == 200) {
                console.log("Network interfaces:", response.json());
                return response;
            } else {
                console.error("Failed to get network interfaces:", response.statusText);
                return [];
            }
        })
        .catch(error => {
            console.error("Failed to get network interfaces:", error);
            return [];
        });
}

const wirelessEncryption = {
    "psk2": "WPA2-PSK",
    "psk-mixed": "WPA2-PSK/WPA-PSK Mixed Mode",
    "sae-mixed": "WPA2-PSK/WPA3-SAE Mixed Mode",
    "sae": "WPA3-SAE"
};
function loadWirelessConfig() {
    callUbus("uci", "get", {config:"wireless" , section: "default_radio0"}).then(response => {
        const wirelessInterface = JSON.parse(response.responseText);
        console.log(wirelessInterface)

        if (!wirelessInterface) {
            console.error('Wireless interface not found');
            return;
        }

        const ssid = wirelessInterface.values.ssid;
        const encryption = wirelessInterface.values.encryption;
        const password = wirelessInterface.values.key;
        const disabled = wirelessInterface.values.disabled || 0 ;

        document.getElementById('wireless-toggle').checked = (disabled == 0);
        document.getElementById('ssid').value = ssid;
        document.getElementById('encryption').value = encryption;
        document.getElementById('password').value = password;

        const isWirelessEnabled = (disabled == 0);
        document.getElementById('ssid').disabled = !isWirelessEnabled;
        document.getElementById('encryption').disabled = !isWirelessEnabled;
        document.getElementById('password').disabled = !isWirelessEnabled;
    }).catch(error => {
        console.error('Failed to retrieve wireless interface:', error);
    });
}

function setWirelessConfig() {
    const isWirelessEnabled = document.getElementById('wireless-toggle').checked;
    const ssid = document.getElementById('ssid').value;
    const encryption = document.getElementById('encryption').value;
    const password = document.getElementById('password').value;
    
    configureWifiRadios(ssid,true,encryption,password,isWirelessEnabled).then(result => {
        console.log('Wifi Result:', result);
    });    
}


const vpnWireguard = document.getElementById('vpn-wireguard');
const vpnL2tp = document.getElementById('vpn-l2tp');
const wireguardConfig = document.getElementById('wireguard-config');
const l2tpConfig = document.getElementById('l2tp-config');

const wgInputs = wireguardConfig.querySelectorAll('input');
const l2tpInputs = l2tpConfig.querySelectorAll('input');

function toggleVpnConfig(vpnType) {
    if (vpnType == 'wireguard') {
        wireguardConfig.style.display = 'block';    
        l2tpConfig.style.display = 'none';
        wgInputs.forEach(input => input.disabled = false);
        l2tpInputs.forEach(input => input.disabled = true);
    } else if (vpnType == 'l2tp') {
        wireguardConfig.style.display = 'none';
        l2tpConfig.style.display = 'block';
        wgInputs.forEach(input => input.disabled = true);
        l2tpInputs.forEach(input => input.disabled = false);
    }
}

vpnWireguard.addEventListener('change', () => toggleVpnConfig('wireguard'));
vpnL2tp.addEventListener('change', () => toggleVpnConfig('l2tp'));

// Initial toggle to set the correct state on page load
toggleVpnConfig('l2tp');

async function loadWireguardConfig() {
    try {
        const response = await callUbus("uci", "get", {config: "network", section: "wg0"});
        const wireguardConfig = JSON.parse(response.responseText);
        if (!wireguardConfig) {
            console.error('WireGuard configuration not found');
            return;
        }
        return wireguardConfig;
    } catch (error) {
        console.error('Failed to retrieve WireGuard configuration:', error);
        return {};
    }
}


// Function to load VPN configuration
async function loadVpnConfig() {

    const l2tpConfig = await loadL2tpConfig();
    const wireguardConfig = await loadWireguardConfig();

    const vpnType = l2tpConfig?.values?.proto || wireguardConfig?.values?.proto || 'wireguard';
    console.log("vpnType", vpnType);
    document.getElementById('vpn-wireguard').checked = (vpnType === 'wireguard');
    document.getElementById('vpn-l2tp').checked = (vpnType === 'l2tp');
    toggleVpnConfig(vpnType);

    if (vpnType == 'l2tp') {
        document.getElementById('l2tp-host').value = l2tpConfig?.values?.server || '';
        document.getElementById('l2tp-username').value = l2tpConfig?.values?.username || '';
        document.getElementById('l2tp-password').value = l2tpConfig?.values?.password || '';
        return;
    }
    
    if (vpnType == 'wireguard') {
        var wireguard= {};
        wireguard = Object.assign({}, wireguardConfig?.values );
        console.log("wireguard", wireguard);
        const response = await callUbus("uci", "get", {config: "network", section: "peer1"});
        const peerConfig = JSON.parse(response.responseText);
        wireguard = Object.assign(wireguard, peerConfig?.values );


        // WireGuard settings
        document.getElementById('wg-private-key').value = wireguard?.private_key || '';
        document.getElementById('wg-public-key').value = wireguard?.public_key || '';
        document.getElementById('wg-endpoint-host').value = wireguard?.endpoint_host || '';
        document.getElementById('wg-endpoint-port').value = wireguard?.endpoint_port || '';
        document.getElementById('wg-address').value = wireguard?.addresses || '';
        document.getElementById('wg-dns').value = wireguard?.dns || '';
        document.getElementById('wg-preshared-key').value = wireguard?.preshared_key || '';
    }


}

// Function to set VPN configuration
async function setVpnConfig() {
    const vpnType = document.getElementById('vpn-wireguard').checked ? 'wireguard' : 'l2tp';

    if (vpnType == 'wireguard') {
        await unsetWgConfig();
        await setWireguardConfig({
            private_key: document.getElementById('wg-private-key').value,
            addresses: document.getElementById('wg-address').value,
            dns: document.getElementById('wg-dns').value,
            listen_port: "51820",
            mtu: "1420",
            public_key: document.getElementById('wg-public-key').value,
            preshared_key: document.getElementById('wg-preshared-key').value,
            endpoint_host: document.getElementById('wg-endpoint-host').value,
            endpoint_port: document.getElementById('wg-endpoint-port').value,
            persistent_keepalive: "25"
        });
        await callUbus('network', 'restart');

    } else {
        // Handle L2TP configuration
        await unsetL2tpConfig();
        await setL2tpConfig({
            server: document.getElementById('l2tp-host').value,
            username: document.getElementById('l2tp-username').value,
            password: document.getElementById('l2tp-password').value
        });
        await callUbus('network', 'restart');
    }
}

async function setWireguardConfig( wgConfig ) {
    console.log("wgConfig", wgConfig);
    var result;
    var params = {
        config: "network",
        type: "interface",
        name: "wg0",
        values: {
            proto: "wireguard",
            private_key: wgConfig.private_key,
            listen_port: wgConfig.listen_port || 50544 ,
            addresses: wgConfig.addresses,
            mtu: wgConfig.mtu || 1420,
            dns: wgConfig.dns || "1.1.1.1"
        }
    };
    result = await uciCall('add', params);
    console.log("Wireguard server setup result", result);

    var peerConfig =  {
        config: "network",
        type: "wireguard_wg0",
        name: "peer1",
        values: {
            public_key: wgConfig.public_key,
            preshared_key: wgConfig.preshared_key,
            allowed_ips: ["0.0.0.0/0", "::/0"],
            route_allowed_ips: "1",
            endpoint_host: wgConfig.endpoint_host,
            endpoint_port: wgConfig.endpoint_port,
            persistent_keepalive: wgConfig.persistent_keepalive || 25
        }
    };
    result = await uciCall('add', peerConfig);
    console.log("WireGuard peer setup result", result);


    var zoneConfig = {
        config: "firewall",
        type: "zone",
        name: "wg_zone",
        values: {
            name: "wg",
            input: "ACCEPT",
            output: "ACCEPT",
            forward: "ACCEPT",
            network: "wg0"
        }
    };
    result = await uciCall('add', zoneConfig);
    console.log("Firewall zone setup result", result);
    

    var forwardingConfig = {
        config: "firewall",
        type: "forwarding",
        name: "wg_forward",
        values: {
            src: "lan",
            dest: "wg"
        }
    };
    result = await uciCall('add', forwardingConfig);
    console.log("Firewall forwarding setup result", result);

    await uciCommit('network');
    await uciCommit('firewall');
}

async function setKillSwitchConfig(enabled) {
    if (!enabled) {
        callUbus('uci', 'delete', {config: 'firewall', section: "vpn_killswitch"}).then(() => {
            console.log('Firewall rule configuration deleted successfully');
            uciCommit('firewall');
        }).catch(error => {
            console.error('Failed to delete Firewall rule configuration:', error);
        });
        return;
    }
    var params = {
        config: "firewall",
        type: "rule",
        name: "vpn_killswitch",
        values: {
            name: "Block non-VPN traffic",
            src: "lan",
            dest: "*",
            proto: "all",
            family: "ipv4",
            target: "REJECT",
            extra: "-o ! wg0" 
        }
    };
    try {
        result = await callUbus('uci', 'add', params)
        uciCommit('firewall');
    } catch (error) {
        console.error('Failed to update Firewall rule configuration:', error);
        return false;
    }
}

async function unsetWgConfig() {
    await uciDelete('network', 'wg0');
    await uciDelete('network', 'peer1');
    await uciDelete('firewall', 'zone', 'wg');
    await uciDelete('firewall', 'forwarding', 'wg_forward');
    await uciDelete('firewall', 'rule', 'vpn_killswitch');

    await uciCommit('firewall');
    await uciCommit('network');
}

async function unsetL2tpConfig() {
    await uciDelete('network', 'l2tp');
    await uciDelete('firewall', 'zone', 'l2tp');
    await uciDelete('firewall', 'forwarding', 'l2tp_forward');
    await uciDelete('firewall', 'rule', 'vpn_killswitch');

    await uciCommit('firewall');
    await uciCommit('network');
}

// Bind the functions to the HTML elements
const reloadButton = document.getElementById('reload-interfaces');
const saveButton = document.getElementById('save-interfaces');
const reloadWirelessButton = document.getElementById('reload-wireless');
const saveWirelessButton = document.getElementById('save-wireless');
const reloadVpnButton = document.getElementById('reload-vpn');
const saveVpnButton = document.getElementById('save-vpn');
const resetConfigButton = document.getElementById('reset-config');

reloadWirelessButton.addEventListener('click', loadWirelessConfig);
saveWirelessButton.addEventListener('click', setWirelessConfig);
reloadVpnButton.addEventListener('click', loadVpnConfig);
saveVpnButton.addEventListener('click', setVpnConfig);
resetConfigButton.addEventListener('click', resetAllConfigurations);

// Function to reset all configurations
async function resetAllConfigurations() {
    if (!confirm('Are you sure you want to reset all VPN configurations, killswitch rules, and firewall settings? This will restart the network.')) {
        return;
    }

    try {
        //showNotification('Resetting configurations...', 'info');
        
        // Remove WireGuard configurations
        try {
            await unsetWgConfig();
        }catch(e){

        }

        // Remove L2TP configurations  
        try {
            await unsetL2tpConfig(); 
        }catch (e) {

        }

        // Remove any additional firewall rules that might have been created
        try {
            await uciDelete('firewall', 'rule', 'vpn_killswitch');
        } catch (e) {
            // Rule might not exist, ignore error
        }
        
        // Commit all changes
        try {
            await uciCommit('network');
            await uciCommit('firewall');
        
        // Restart network
            await callUbus('system', 'reboot');
        } catch(e) {

        }
        
        
        //showNotification('All configurations have been reset and network restarted successfully', 'success');
        
        // Reload the configurations to reflect the changes
        setTimeout(() => {
            window.location.href = 'http://192.168.3.1/cgi-bin/luci/admin/services/linkmask'; 
        }, 200);
        
    } catch (error) {
        console.error('Failed to reset configurations:', error);
    }
}

function showNotification(message, severity) {
    L.ui.addNotification({
        message: message,
        severity: severity, // "info", "warning", "error", "success"
    });
}


callUbus('luci-rpc', 'getBoardJSON').then(response => {
    console.log("Board info:", response);
}).catch(error => {
    console.error('Failed to retrieve board info:', error);
});
