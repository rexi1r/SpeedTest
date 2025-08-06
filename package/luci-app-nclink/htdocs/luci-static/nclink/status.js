// Status update functions
function updateWanStatus() {

    callUbus('network.interface', 'dump').then(response => {
        const responseData = JSON.parse(response.responseText);
        console.log("responseData", responseData);
        const interfaces = responseData?.interface;
        const wanInterface = interfaces.find(iface => iface.interface === 'wan');
        const wwanInterface = interfaces.find(iface => iface.interface === 'wwan');
        

        var status = wanInterface?.up ? 'connected' : 'disconnected';
        var ipaddr = wanInterface?.['ipv4-address']?.[0]?.['address'] || '-';
        var gateway = wanInterface?.route?.[0]?.['nexthop'] || '-';
        var dns = wanInterface?.['dns-server']?.[0] || '-';
        var uptime = formatUptime(wanInterface?.uptime || 0);

        if(wwanInterface?.up && wanInterface?.up == false) {
            status = wwanInterface.up ? 'connected' : 'disconnected';
            ipaddr = wwanInterface['ipv4-address']?.[0]?.['address'] || '-';
            gateway = wwanInterface.route?.[0]?.['nexthop'] || '-';
            dns = wwanInterface['dns-server']?.[0] || '-';
            uptime = formatUptime(wwanInterface.uptime || 0);
        }
        
        document.getElementById('wan-proto').textContent = wanInterface.proto || '-';
        document.getElementById('wan-status').textContent = status;
        document.getElementById('wan-status').className = `status-value ${status}`;
        document.getElementById('wan-ip').textContent = ipaddr;
        document.getElementById('wan-gateway').textContent = gateway;
        document.getElementById('wan-dns').textContent = dns;
        document.getElementById('wan-uptime').textContent = uptime;

    }).catch(error => {
        console.error('Failed to get WAN status:', error);
    });
}

function updateWifiStatus() {
    callUbus('network.wireless', 'status').then(response => {
        const radios = JSON.parse(response.responseText);
        console.log("radios", radios);
        const availableRadios = Object.keys(radios);
        var wifiStatus = {
            "status": [],
            "channel": [],
            "band": [],
            "interfaces": []
        };

        for (const radio of availableRadios) {
            wifiStatus["status"].push(radios[radio].up ? 'up' : 'down');
            wifiStatus["channel"].push(radios[radio].config.channel || '-');
            wifiStatus["band"].push(radios[radio].config.band || '-'); 
            wifiStatus["interfaces"].push(radios[radio].interfaces?.length || '0');
        }
     

        document.getElementById('wifi-status').textContent = wifiStatus["status"].join(" / ");
        if(wifiStatus["status"].includes('up')) {
            document.getElementById('wifi-status').className = `status-value connected`;
        } else {
            document.getElementById('wifi-status').className = `status-value disconnected`;
        }
        document.getElementById('wifi-channel').textContent = wifiStatus["channel"].join(" / ");
        document.getElementById('wifi-band').textContent = wifiStatus["band"].join(" / ");
        document.getElementById('wifi-interfaces').textContent = wifiStatus["interfaces"].join(" / ");

    }).catch(error => {
        console.error('Failed to get WiFi status:', error);
    });
}

function updateVpnStatus() {
    callUbus('network.interface', 'dump').then(response => {
        const interfaces = response.json().interface;
        const vpnInterface = interfaces.find(iface => iface.interface === 'l2tp');
        if (!vpnInterface) {
            vpnInterface = interfaces.find(iface => iface.interface === 'wg0');
        }

        
        if (vpnInterface) {
            const status = vpnInterface.up ? 'connected' : 'disconnected';
            const ipaddr = vpnInterface['ipv4-address']?.[0]?.['address'] || '-';
            const uptime = formatUptime(vpnInterface.uptime || 0);
            const type = vpnInterface.proto || '-';

            document.getElementById('vpn-status').textContent = status;
            document.getElementById('vpn-status').className = `status-value ${status}`;
            document.getElementById('vpn-type').textContent = type;
            document.getElementById('vpn-ip').textContent = ipaddr;
            document.getElementById('vpn-uptime').textContent = uptime;
        } else {
            document.getElementById('vpn-status').textContent = 'disconnected';
            document.getElementById('vpn-status').className = 'status-value disconnected';
            document.getElementById('vpn-type').textContent = '-';
            document.getElementById('vpn-ip').textContent = '-';
            document.getElementById('vpn-uptime').textContent = '-';

        }
    }).catch(error => {
        console.error('Failed to get VPN status:', error);
    });
}

// Utility functions
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update all statuses
function updateAllStatus() {
    updateWanStatus();
    updateWifiStatus();
    updateVpnStatus();
}

// Auto-refresh every 30 seconds
//setInterval(updateAllStatus, 5000);
updateAllStatus();
document.getElementById('refresh-status').addEventListener('click', updateAllStatus);