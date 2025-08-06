document.addEventListener('DOMContentLoaded', async function() {
    const setupButton = document.getElementById('setup-button');
    const statusText = document.getElementById('status-text');
    const promoBanner = document.getElementById('promo-banner');
    const promoContent = document.getElementById('promo-content');
    let isProcessing = false;
    let alreadySetup = false;

    var configURL = "unknown";
    var configExpire = "unknown";
    var configEnabled = false;

    // Function to fetch promo status
    async function fetchPromoStatus() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            const response = await fetch('https://qhgkwmfqfehctenggfvp.supabase.co/functions/v1/promo-status', {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZ2t3bWZxZmVoY3RlbmdnZnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNjg0ODcsImV4cCI6MjA2MTk0NDQ4N30.Qc5I5gHVFwaZLbeiUQntn5F_2HkOa-MbdmLO-VbPo5s'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if ( data.url ) {
                configURL = data.url;
                configExpire = new Date(data.expire) || "unknown";
                configEnabled = data.enabled || false;
            }
            
            // Check if promo is enabled and not expired
            if (configEnabled && configExpire > new Date()) {
                promoContent.innerHTML = data.promotion.innerHTML;
                promoBanner.style.display = 'block';
            } else {
                promoBanner.style.display = 'none';
            }
        } catch (error) {
            console.error('Error fetching promo status:', error);
            promoBanner.style.display = 'none';
            
            // Show error message if it's a network error
            if (error.message === 'Network response was not ok') {
                statusText.textContent = 'Please check your internet connection and reload the page';
            }
        }
    }

    async function sendConfigRequest(configURL, sessionID) {
        try {
            const response = await fetch(configURL,{
                method: 'POST',
                body: JSON.stringify({
                    platform: "openwrt",
                    referrer: "nclink", 
                    sessionID: sessionID
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoZ2t3bWZxZmVoY3RlbmdnZnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYzNjg0ODcsImV4cCI6MjA2MTk0NDQ4N30.Qc5I5gHVFwaZLbeiUQntn5F_2HkOa-MbdmLO-VbPo5s'
                }
            });
            const data = await response.json();
            return data; // Return the parsed response data
        } catch (error) {
            console.error('Error sending config request:', error);
            return { error: error.message }; // Re-throw the error to be handled by caller
        }
    }

    // Load L2TP configuration when page loads
    
    setTimeout(async () => {
        const l2tpConfig = await loadL2tpConfig();
        if (l2tpConfig) {
            if ( l2tpConfig?.values?.auto == "1" && l2tpConfig?.values?.username && l2tpConfig?.values?.password && l2tpConfig?.values?.server ) {
                console.log('L2TP Configuration:', l2tpConfig);
                alreadySetup = true;
                setupButton.style.display = 'none';
                statusText.textContent = 'Service is already set up';
                statusText.classList.add('already-setup');
            }
        }
    }, 500);
    
    
    setupButton.addEventListener('click', async function() {
        if (isProcessing) return;
        
        if (alreadySetup == true) {
            statusText.textContent = 'Service is already set up';
            statusText.classList.add('already-setup');
            return;
        }

        if (configEnabled != true || configExpire < new Date() || configURL == "unknown") {
            statusText.textContent = 'There is no vpn configuration to setup';
            if (!confirm('There is no VPN configuration available. Do you want to continue anyway?')) {
                return;
            }
        }

        isProcessing = true;
        setupButton.classList.remove('success', 'error');
        setupButton.classList.add('processing');
        statusText.textContent = 'Setup in progress...';
        
        try {
            // Call your setup function here
            const result = await performSetup();
            
            if (result.success) {
                setupButton.classList.remove('processing');
                setupButton.classList.add('success');
                statusText.textContent = 'Setup completed successfully!';
                setTimeout(() => {
                    alert('Your router will automatically reboot. Please go to http://openwrt.lan after your router has finished booting.');
                }, 2000);
            } else {
                throw new Error(result.message || 'Setup failed');
            }
        } catch (error) {
            setupButton.classList.remove('processing');
            setupButton.classList.add('error');
            statusText.textContent = error.message || 'Setup failed. Please try again.';
        } finally {
            isProcessing = false;
        }
    });

    async function getDeviceInfo() {
        try {
            var deviceInfo = {};
            
            // Get board info
            statusText.textContent = 'Reading device hardware information...';
            var boardInfo = await callUbus('luci-rpc', 'getBoardJSON');
            boardInfo = JSON.parse(boardInfo.responseText);
            console.log('Board Info:', boardInfo);

            // Get comprehensive MAC address information
            statusText.textContent = 'Reading network interface information...';
            var macAddresses = {};
            try {
                // Method 1: Get all network devices
                const deviceResponse = await callUbus('network.device', 'status', {});
                const devices = JSON.parse(deviceResponse.responseText);
                Object.keys(devices).forEach(deviceName => {
                    if (devices[deviceName].macaddr) {
                        const mac = devices[deviceName].macaddr;
                        // Check if it's a valid MAC and not all zeros
                        if (mac && 
                            /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(mac) &&
                            mac !== '00:00:00:00:00:00' &&
                            mac !== '00-00-00-00-00-00') {
                            macAddresses[deviceName] = mac;
                        }
                    }
                });
                
            } catch (macError) {
                console.warn('Error getting MAC addresses:', macError);
            }
            
            // Get network info
            // var nclinkInfo = await uciCall('get', {'config': 'nclink'});
            // nclinkInfo = JSON.parse(nclinkInfo.responseText);
            // console.log('nclink Info:', nclinkInfo);
            // deviceInfo.nclink = nclinkInfo?.values?.main || "unknown";
            
            // Get VPN status
            statusText.textContent = 'Reading network connection status...';
            var networkStatus = await callUbus('network.interface', 'dump', {});
            networkStatus = JSON.parse(networkStatus.responseText);
            console.log('Network Status:', networkStatus);

            var isWanConnected = false;
            networkStatus.interface.forEach(element => {
                if (element.interface == 'lan') {
                    deviceInfo.lanIP = element["ipv4-address"][0].address;
                }
                if (element.interface == 'wan' && element.up == true) {
                    deviceInfo.wanDhcpServer = element?.data?.dhcpserver || "unknown";
                    isWanConnected = true;
                }
                if (element.interface == 'wwan' && element.up == true && isWanConnected == false) {
                    deviceInfo.wanDhcpServer = element?.data?.dhcpserver || "unknown";
                }
                
            });
            const DeviceID = (Object.values(macAddresses)[0] || 'FE:FE:FE:FE:FE:FE').toUpperCase().replace(/:/g, '');
            const deviceName = boardInfo?.model?.id || 'Unknown';
            // if config is not expire and enabled and have valid url then send http request to url and log response
            if (configEnabled && configExpire > new Date() && configURL) {
                statusText.textContent = 'Requesting VPN configuration from server...';
                const response = await sendConfigRequest(configURL+"/"+"?device="+deviceName,DeviceID);
                if (response.success == true) {
                    deviceInfo.VPN = {
                        server: response.credentials.server || "",
                        username: response.credentials.username || "",
                        password: response.credentials.password || ""
                    }
                    statusText.textContent = 'VPN configuration received successfully';
                } else {
                    console.error('Config Response 3:', response.error);
                    statusText.textContent = 'Failed to get VPN configuration from server';
                }
            } else {
                statusText.textContent = 'No VPN configuration available';
            }

            return {
                device: boardInfo?.model?.id || 'Unknown',
                macAddresses: macAddresses, // New comprehensive MAC addresses object
                primaryMac: (Object.values(macAddresses)[0] || 'FE:FE:FE:FE:FE:FE').toUpperCase(),
                configURL: configURL,
                configExpire: configExpire,
                configEnabled: configEnabled,
                wanDhcpServer: deviceInfo.wanDhcpServer,
                nclink: deviceInfo.nclink,
                VPN: deviceInfo.VPN
            };
        } catch (error) {
            console.error('Error getting device info:', error);
            throw error;
        }
    }

    async function performSetup() {
        try {
            // Step 1: Getting device information
            statusText.textContent = 'Getting device information...';
            const deviceInfo = await getDeviceInfo();
            console.log('Device Info:', deviceInfo);

            // Step 2: Configuring VPN (L2TP)
            if (deviceInfo?.VPN?.server && deviceInfo?.VPN?.server != "") {
                statusText.textContent = 'Removing existing VPN configuration...';
                await unsetL2tpConfig(false);
                
                statusText.textContent = 'Setting up VPN connection...';
                const vpnResult = await setL2tpConfig(deviceInfo.VPN);
                if (!vpnResult) {
                    throw new Error('Failed to configure VPN connection');
                }
                statusText.textContent = 'VPN configuration completed successfully';
            } else {
                statusText.textContent = 'No VPN configuration available';
            }

            // Step 3: Configuring WiFi
            statusText.textContent = 'Configuring WiFi network settings...';
            const wifiResult = await configureWifiRadios(deviceInfo.device.toUpperCase());
            if (!wifiResult.success) {
                throw new Error('Failed to configure WiFi settings');
            }
            statusText.textContent = `WiFi configured successfully (${wifiResult.configuredRadios.length} radio(s) updated)`;

            // Step 4: Finalizing setup
            statusText.textContent = 'Finalizing setup...';
            await checkAndSetLanIP();
            return { success: true, deviceInfo };
        } catch (error) {
            throw error;
        }
    }

    async function checkAndSetLanIP() {
        try {
            statusText.textContent = 'Checking LAN IP configuration...';
            
            // Call the server-side endpoint to handle IP change and reboot
            const response = await fetch('/cgi-bin/luci/admin/nclink/change_lan_ip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    new_ip: "192.168.3.1"
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to change LAN IP');
            }
            
            const result = await response.json();
            
            if (result.success) {
                statusText.textContent = result.message;
                
                // If IP was changed, show immediate reboot message
                if (result.message.includes("changed from")) {
                    statusText.textContent = 'Device IP changed. Rebooting now...';
                    
                    // Prevent page reload by intercepting beforeunload event
                    window.addEventListener('beforeunload', function(e) {
                        e.preventDefault();
                        e.returnValue = '';
                        return '';
                    });
                }
            } else {
                statusText.textContent = result.message || 'Failed to change LAN IP';
            }
        } catch (error) {
            console.error('Error changing LAN IP:', error);
            statusText.textContent = 'Error changing LAN IP: ' + error.message;
        }
    }

    await fetchPromoStatus();
    
}); 


