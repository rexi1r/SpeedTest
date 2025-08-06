-- File: /usr/lib/lua/luci/controller/pingtest.lua

module("luci.controller.pingtest", package.seeall)

local http = require "luci.http"
local util = require "luci.util"
local sys  = require "luci.sys"
local json = require "luci.jsonc" -- Used for parsing JSON
local io   = require "io"

local function is_ip4(dest)
  return dest and dest:match("^%d+%.%d+%.%d+%.%d+$")
end

-- Function to safely read and parse a JSON file
local function read_and_parse_json_file(filepath)
    local content = nil
    local file = io.open(filepath, "r")
    if file then
        content = file:read("*a")
        file:close()
    else
        util.perror("pingtest: Could not open " .. filepath .. " for reading.")
        return nil, "File not found: " .. filepath
    end

    if content and #content > 0 then
        local success, data = pcall(json.parse, content)
        if success then
            return data
        else
            util.perror("pingtest: Failed to parse JSON from " .. filepath .. ": " .. data)
            return nil, "JSON parse error: " .. data
        end
    else
        util.perror("pingtest: " .. filepath .. " is empty.")
        return nil, "File is empty: " .. filepath
    end
end

local allowed_hosts = {
  ["varzesh3.com"]= true,
  ["arvancloud.ir"] = true,
  ["playstation.com"] = true,
  ["wikipedia.org"] = true,
  ["bing.com"]= true,
  ["google.com"]= true,
  ["github.com"]= true,
  ["digikala.com"]= true,
  ["divar.ir"]= true,
  ["aparat.com"]= true,
  ["8.8.8.8"] = true,
  ["4.2.2.4"] = true
}

local allowed_if = {
  wan= true,
  ["pppossh-sshvpn"] = true
}

function index()
  entry({ "admin", "services", "pingtest" }, firstchild(), _("Ping & Speed"), 90).dependent = false
  entry({ "admin", "services", "pingtest", "index" }, template("pingtest/index"), _("Dashboard"), 10).leaf = true
  entry({ "admin", "services", "pingtest", "run_ping" }, post("run_ping_test")).leaf = true -- New endpoint for ping
  entry({ "admin", "services", "pingtest", "run_speedtest" }, post("run_speed_test")).leaf = true -- New endpoint for speedtest
end

function run_ping_test()
  http.prepare_content("application/json")
  util.perror("pingtest: STEP 1 START run_ping_test controller")

  local ok, resp = xpcall(function()
    local dest = (http.formvalue("dest") or ""):lower():match("^[%w%.%-]+$") or ""
    local iface_selected = (http.formvalue("iface") or ""):lower():match("^[%w%-]+$") or ""

    util.perror(("pingtest: STEP 2 inputs dest=%q iface=%q"):format(dest, iface_selected))

    -- Validate inputs
    if not allowed_hosts[dest] then
      error("Invalid destination: " .. dest)
    end
    if not allowed_if[iface_selected] then
      error("Invalid interface: " .. iface_selected)
    end

    -- Ping test
    local ping_cmd
    if is_ip4(dest) then
      ping_cmd = ("ping -4 -c 10 -W 1 -I %q %q"):format(iface_selected, dest)
    else
      ping_cmd = ("ping -4 -c 10 -W 1 %q"):format(dest)
    end
    util.perror("pingtest: STEP 3 exec ping: " .. ping_cmd)
    local ping_out = sys.exec(ping_cmd .. " 2>&1")
    util.perror("pingtest: STEP 4 ping output: " .. (ping_out or "<nil>"))

    if not ping_out or ping_out:match("Network unreachable") then
      error("Ping test failed or no network")
    end

    -- Parse ping results
    local sent, recv = ping_out:match("(%d+) packets transmitted, (%d+) packets received")
    util.perror(("pingtest: STEP 5-1 parsed stats sent=%s recv=%s"):format((sent or "<nil>"), (recv or "<nil>")))
    sent = tonumber(sent) or 0
    recv = tonumber(recv) or 0
    local loss_pct = tonumber(ping_out:match("(%d+)%% packet loss"))
    if not loss_pct and sent and recv and sent > 0 then
      loss_pct = 100 * (sent - recv) / sent
    end
    loss_pct = loss_pct or 100

    local min_latency = "-"
    local avg_latency = "-"
    local max_latency = "-"
    local min_, avg_, max_ = ping_out:match("rtt [^=]+= ([%d%.]+)/([%d%.]+)/([%d%.]+)")
    if min_ and avg_ and max_ then
      min_latency = min_
      avg_latency = avg_
      max_latency = max_
    else
      min_, avg_, max_ = ping_out:match("round%-trip [^=]+= ([%d%.]+)/([%d%.]+)/([%d%.]+)")
      if min_ and avg_ and max_ then
        min_latency = min_
        avg_latency = avg_
        max_latency = max_
      end
    end

    util.perror(("pingtest: STEP 5 parsed stats sent=%s recv=%s loss=%.1f min=%s avg=%s max=%s"):format(
      tostring(sent), tostring(recv), loss_pct, min_latency, avg_latency, max_latency
    ))

    -- Prepare data for the view
    return {
      iface      = iface_selected,
      dest       = dest,
      sent       = sent,
      recv       = recv,
      loss_pct   = loss_pct,
      min_ping   = min_latency,
      avg_ping   = avg_latency,
      max_ping   = max_latency,
      token      = luci.dispatcher.context.token
    }
  end, debug.traceback)

  if not ok then
    util.perror("pingtest: ERROR in run_ping_test → " .. resp)
    http.status(500, "Internal Error")
    return http.write_json({ err = resp })
  end

  util.perror("pingtest: STEP 9 DONE run_ping_test controller")
  return http.write_json(resp)
end

function run_speed_test()
  http.prepare_content("application/json")
  util.perror("pingtest: STEP 1 START run_speed_test controller")

  local ok, resp = xpcall(function()
    util.perror("pingtest: STEP 2 running testspeed.sh to generate WAN and VPN speedtest files.")
    sys.exec("bash -c '/usr/lib/lua/luci/testspeed.sh'") 
    
    -- Read and parse WAN speedtest results
    local wan_speedtest_data = read_and_parse_json_file("/tmp/speedtest_wan.txt")
    if not wan_speedtest_data then
        util.perror("pingtest: Failed to get WAN speedtest data. Setting defaults.")
        wan_speedtest_data = {} -- Ensure it's a table to avoid nil errors later
    end

    -- Read and parse VPN speedtest results
    local vpn_speedtest_data = read_and_parse_json_file("/tmp/speedtest_vpn.txt")
    if not vpn_speedtest_data then
        util.perror("pingtest: Failed to get VPN speedtest data. Setting defaults.")
        vpn_speedtest_data = {} -- Ensure it's a table
    end

    util.perror("pingtest: STEP 3 WAN Speedtest Data: " .. json.stringify(wan_speedtest_data))
    util.perror("pingtest: STEP 4 VPN Speedtest Data: " .. json.stringify(vpn_speedtest_data))

    -- Prepare data for the view
    return {
      -- WAN Speedtest Data
      wan_st_download = string.format("%.2f", (wan_speedtest_data.download or 0) / 1000000), -- Convert bytes/sec to Mbps
      wan_st_upload   = string.format("%.2f", (wan_speedtest_data.upload or 0) / 1000000),   -- Convert bytes/sec to Mbps
      wan_st_ping     = string.format("%.2f", wan_speedtest_data.ping or 0),
      wan_st_name     = wan_speedtest_data.server and wan_speedtest_data.server.name or "-",
      wan_st_country  = wan_speedtest_data.server and wan_speedtest_data.server.country or "-",
      wan_st_sponsor  = wan_speedtest_data.server and wan_speedtest_data.server.sponsor or "-",
      wan_st_ip       = wan_speedtest_data.client and wan_speedtest_data.client.ip or "-",
      wan_st_isp      = wan_speedtest_data.client and wan_speedtest_data.client.isp or "-",

      -- VPN Speedtest Data
      vpn_st_download = string.format("%.2f", (vpn_speedtest_data.download or 0) / 1000000), -- Convert bytes/sec to Mbps
      vpn_st_upload   = string.format("%.2f", (vpn_speedtest_data.upload or 0) / 1000000),   -- Convert bytes/sec to Mbps
      vpn_st_ping     = string.format("%.2f", vpn_speedtest_data.ping or 0),
      vpn_st_name     = vpn_speedtest_data.server and vpn_speedtest_data.server.name or "-",
      vpn_st_country  = vpn_speedtest_data.server and vpn_speedtest_data.server.country or "-",
      vpn_st_sponsor  = vpn_speedtest_data.server and vpn_speedtest_data.server.sponsor or "-",
      vpn_st_ip       = vpn_speedtest_data.client and vpn_speedtest_data.client.ip or "-",
      vpn_st_isp      = vpn_speedtest_data.client and vpn_speedtest_data.client.isp or "-",
      
      token           = luci.dispatcher.context.token
    }
  end, debug.traceback)

  if not ok then
    util.perror("pingtest: ERROR in run_speed_test → " .. resp)
    http.status(500, "Internal Error")
    return http.write_json({ err = resp })
  end

  util.perror("pingtest: STEP 5 DONE run_speed_test controller")
  return http.write_json(resp)
end

