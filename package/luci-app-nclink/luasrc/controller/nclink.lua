-- /usr/lib/lua/luci/controller/nclink.lua

module("luci.controller.nclink", package.seeall)

-- Get package version for cache busting
function get_package_version()
  local version_file = "/usr/lib/opkg/status"
  local file = io.open(version_file, "r")
  if file then
    local content = file:read("*all")
    file:close()
    local found_package = false
    for line in content:gmatch("[^\r\n]+") do
      if line:match("^Package: luci%-app%-nclink$") then
        found_package = true
      elseif found_package and line:match("^Version:") then
        return line:match("Version: ([^%s]+)")
      elseif line == "" then
        found_package = false
      end
    end
  end
  -- Fallback version if package not found
  return "1.2"
end

function index()
  entry({"admin", "services", "linkmask"}, firstchild(), "LinkMask", 30)
  entry({"admin", "services", "linkmask", "settings"}, call("render_settings"), "Settings", 10)
  entry({"admin", "services", "linkmask", "status"}, call("render_status"), "Status", 20)
  entry({"admin", "services", "linkmask", "wizard"}, call("render_wizard"), "Wizard", 5)
  entry({"admin", "nclink", "ubus_proxy"}, call("action_ubus_proxy"), "UBUS Proxy", 10).dependent = false
  entry({"admin", "nclink", "change_lan_ip"}, call("action_change_lan_ip"), "Change LAN IP", 10).dependent = false
end

function render_settings()
  local version = get_package_version()
  luci.template.render("nclink/nclink", { version = version })
end

function render_status()
  local version = get_package_version()
  luci.template.render("nclink/status", { version = version })
end

function render_wizard()
  local version = get_package_version()
  luci.template.render("nclink/wizard", { version = version })
end

function action_ubus_proxy()
  local http = require "luci.http"
  local ubus = require "ubus"
  local json = require "luci.jsonc"

  local conn = ubus.connect()
  if not conn then
    http.status(500, "Failed to connect to UBUS")
    return
  end

  -- Read request body (UBUS call parameters)
  local request_data = http.content()
  local request_json = json.parse(request_data or "{}")

  local object = request_json.object
  local method = request_json.method
  local params = request_json.params or {}

  if not object or not method then
    http.status(400, "Missing 'object' or 'method' in request")
    conn:close()
    return
  end

  -- Call UBUS with requested parameters
  local result, err = conn:call(object, method, params)
  conn:close()

  -- Log the result for debugging
  if result then
      print("UBUS call result:", result)
  else
      print("UBUS call error:", err)
  end

  -- Adjust error handling
  if err then
    http.status(403, "UBUS call failed: " .. err)
    return
  end

  http.prepare_content("application/json")
  http.write_json(result or { message = "Command executed successfully" })
end

function action_change_lan_ip()
  local http = require "luci.http"
  local ubus = require "ubus"
  local json = require "luci.jsonc"
  
  -- Read request body
  local request_data = http.content()
  local request_json = json.parse(request_data or "{}")
  
  local new_ip = request_json.new_ip or "192.168.3.1"
  
  local result = { success = false, message = "" }
  
  local conn = ubus.connect()
  if not conn then
    result.message = "Failed to connect to UBUS"
    http.prepare_content("application/json")
    http.write_json(result)
    return
  end
  
  local success, err = pcall(function()
    -- Get current LAN IP using UBUS UCI
    local uci_get_result, uci_get_err = conn:call("uci", "get", {
      config = "network",
      section = "lan",
      option = "ipaddr"
    })
    
    if uci_get_err then
      result.message = "Could not get current LAN IP: " .. tostring(uci_get_err)
      return
    end
    
    if not uci_get_result or not uci_get_result.value then
      result.message = "Could not get current LAN IP value"
      return
    end
    
    local current_ip = uci_get_result.value
    
    -- Check if IP needs to be changed
    if current_ip == "192.168.1.1" or current_ip == "192.168.1.2" then
      -- Set new IP using UBUS
      local uci_set_result, uci_set_err = conn:call("uci", "set", {
        config = "network",
        section = "lan",
        values = { ipaddr = new_ip }
      })
      
      if uci_set_err then
        result.message = string.format("Failed to set new LAN IP from %s to %s: %s", current_ip, new_ip, tostring(uci_set_err))
        return
      end
      
      -- Commit network configuration
      local commit_result, commit_err = conn:call("uci", "commit", {
        config = "network"
      })
      
      if commit_err then
        result.message = "Failed to commit network configuration: " .. tostring(commit_err)
        return
      end
      
      result.success = true
      result.message = string.format("LAN IP changed from %s to %s. Device will reboot now.", current_ip, new_ip)
      
      -- Reboot immediately using UBUS system restart
      local reboot_result, reboot_err = conn:call("system", "reboot", {})
      
      if reboot_err then
        result.message = "LAN IP changed but failed to reboot: " .. tostring(reboot_err)
      end
    else
      result.success = true
      result.message = string.format("LAN IP is already %s, no change needed", current_ip)
      
      -- Still reboot even if no IP change needed
      local reboot_result, reboot_err = conn:call("system", "reboot", {})
      
      if reboot_err then
        result.message = "Failed to reboot: " .. tostring(reboot_err)
      end
    end
  end)
  
  conn:close()
  
  if not success then
    result.message = "Error changing LAN IP: " .. tostring(err)
  end
  
  http.prepare_content("application/json")
  http.write_json(result)
end
