function callUbus(object, method, params = {}) {
    return L.Request.post(L.url('admin/nclink/ubus_proxy'), {
        object: object,
        method: method,
        params: params
    }).then(function(response) {
        //console.log("UBUS Response:", response);
        if (!response.ok) {
            throw new Error(response.statusText || 'UBUS call failed');
        }
        return response;
    }).catch(function(error) {
        console.error("UBUS call failed:", error);
        throw error;
    });
}

async function uciCall( method , params ) {
    var result;
    try {
        result = await callUbus('uci', method, params);
        return result;
    } catch (error) {
        console.error('Failed to call uci:', error);
        return false;
    }
}

async function uciCommit(config) {
    await callUbus('uci', 'commit', {config: config}).then(() => {
        console.log(config + ' configuration updated successfully');
    }).catch(error => {
        console.error('Failed to commit ' + config + ' configuration:', error);
    });
}

async function uciDelete(config, section) {
    await callUbus('uci', 'delete', {config: config, section: section}).then(() => {
        console.log(config + ' configuration deleted successfully');
    }).catch(error => {
        console.error('Failed to delete ' + config + ' configuration:', error);
    });
}

async function setLanIP(ip) {
    await uciCall('set', {
        config: 'network',
        section: 'lan',
        values: { ipaddr: ip }
    });
}
async function getLanIP() {
    const lanConfig = await uciCall('get', { config: 'network', section: 'lan' });
    if (!lanConfig) {
        throw new Error('Failed to get lan configuration');
    }
    const lanData = JSON.parse(lanConfig.responseText);
    return lanData?.values?.ipaddr || "unknown";
}

async function configureWifiRadios(ssidName,force = false,encryption = 'sae-mixed',password = "goodlife",isWirelessEnabled = true) {
    try {
        console.log('Configuring WiFi radios with SSID:', ssidName);
        
        // Get all wireless configurations
        if (typeof statusText !== 'undefined') {
            statusText.textContent = 'Reading current WiFi configuration...';
        }
        const wirelessConfig = await uciCall('get', { config: 'wireless' });
        if (!wirelessConfig) {
            throw new Error('Failed to get wireless configuration');
        }
        
        const wirelessData = JSON.parse(wirelessConfig.responseText);
        const wifiConfigKeys = Object.keys(wirelessData?.values || {});
        console.log('Wireless configuration:', wirelessData);
        
        let configuredRadios = [];
        let errors = [];
        

        // Iterate through all wireless sections
        for (const sectionName of wifiConfigKeys) {
            // Check if this is a radio section (contains 'radio' in the name)
            if (wirelessData?.values?.[sectionName]?.[".type"] == "wifi-device") {
                await uciCall('set', {
                    config: 'wireless',
                    section: sectionName,
                    values: {
                        disabled: isWirelessEnabled ? "0" : "1"
                    }
                });
                continue;
            }

            if ( wirelessData?.values?.[sectionName]?.mode == "ap") {
                const radioName = sectionName;
                console.log(`Processing radio: ${radioName}`);
                
                try {
                    // Check if the radio has default OpenWrt SSID
                    const currentSSID = wirelessData?.values?.[sectionName]?.ssid || "unknown";
                    const isOpenWrtSSID = currentSSID.toLowerCase().includes('openwrt') || currentSSID.toLowerCase().includes('lede') || currentSSID === 'OpenWrt' || currentSSID === 'LEDE';
                    
                    if (isOpenWrtSSID || force) {
                        console.log(`Radio ${radioName} has OpenWrt SSID: ${currentSSID}, updating to: ${ssidName} with encryption: ${encryption}, force: ${force}`);
                        
                        // Update SSID
                        await uciCall('set', {
                            config: 'wireless',
                            section: radioName,
                            values: {
                                ssid: ssidName,
                                encryption: encryption,
                                key: password,
                                disabled: isWirelessEnabled ? "0" : "1"
                            }
                        });
                        
                        
                        configuredRadios.push({
                            radio: radioName,
                            oldSSID: currentSSID,
                            newSSID: ssidName,
                            encryption: encryption,
                            enabled: isWirelessEnabled
                        });
                    } else {
                        console.log(`Radio ${radioName} already has custom SSID: ${currentSSID}, skipping`);
                    }
                } catch (radioError) {
                    console.error(`Error configuring radio ${radioName}:`, radioError);
                    errors.push({
                        radio: radioName,
                        error: radioError.message
                    });
                }
            }
        }
        
        // Commit changes if any radios were configured
        if (configuredRadios.length > 0) {
            if (typeof statusText !== 'undefined') {
                statusText.textContent = 'Saving WiFi configuration...';
            }
            await uciCommit('wireless');
            console.log('Wireless configuration committed successfully');
            
            // Restart wireless service
            try {
                if (typeof statusText !== 'undefined') {
                    statusText.textContent = 'Restarting WiFi services...';
                }
                console.log('Network service need to be restarted');
            } catch (restartError) {
                console.warn('Failed to restart network service:', restartError);
                // Don't fail the entire operation if restart fails
            }
        }
        
        return {
            success: true,
            configuredRadios: configuredRadios,
            errors: errors,
            totalProcessed: configuredRadios.length + errors.length,
            message: `Successfully configured ${configuredRadios.length} radio(s) with SSID: ${ssidName}`
        };
        
    } catch (error) {
        console.error('Error configuring WiFi radios:', error);
        return {
            success: false,
            error: error.message,
            configuredRadios: [],
            errors: [error.message]
        };
    }
}