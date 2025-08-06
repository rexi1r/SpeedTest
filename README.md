# LinkMask

A community-focused networking solution for OpenWrt.

## Prerequisites

Before installing NCLink, ensure you have the following setup:

### Hardware Requirements
- A device that supports OpenWrt 23.05
- You can find compatible devices and installation instructions at the [OpenWrt Firmware Selector](https://firmware-selector.openwrt.org/?version=23.05.5) (search for your device ex: Tp-link)

Watch this video guide on how to select and download the correct firmware for your device:

https://github.com/nasnet-community/linkmask/raw/refs/heads/main/docs/video/select_firmware.mp4


### OpenWrt Installation
1. Install OpenWrt 23.05 firmware on your device following the instructions from the OpenWrt Hardware Selector
2. Ensure your router is connected to the internet and has a stable connection

### Network Configuration
**Important**: If your Starlink router uses the same IP range (192.168.1.x) as OpenWrt's default (192.168.1.1), you must change the LAN IP range to avoid conflicts:

1. Access the LuCI web interface at `http://192.168.1.1`
2. Navigate to **Network** → **Interfaces** → **LAN**
3. Change the IPv4 address from `192.168.1.1` to `192.168.3.1`
4. Save and apply the changes
5. Access the interface using the new IP: `http://192.168.3.1`

Change LAN IP Video : 
https://github.com/nasnet-community/linkmask/raw/refs/heads/main/docs/video/change_lan_ip.mp4

### Security Setup
1. Set a strong password for the LuCI web interface:
   - Go to **System** → **Administration**
   - Enter a strong password in the "Password" field
   - Save the changes

Set Root password Video : 
https://github.com/nasnet-community/linkmask/raw/refs/heads/main/docs/video/set_root_password.mp4


## Installation

### Quick Installation via SSH

The easiest way to install NCLink is using our automated installation script. This script will automatically detect your device's architecture and install the correct package.

Watch the installation video:
https://github.com/nasnet-community/linkmask/raw/refs/heads/main/docs/video/Install.mp4


1.  open the Terminal app on your device and SSH into your OpenWrt router buy typing the following command:
   ```bash
   ssh root@192.168.3.1 
   ```
   If you dont change the lan ip address its 192.168.1.1

2. Run the following command to download and execute the installation script:
   ```bash
   wget -O- https://raw.githubusercontent.com/nasnet-community/linkmask/main/install.sh | sh
   ```

   If wget is not available, you can use curl:
   ```bash
   curl -s https://raw.githubusercontent.com/nasnet-community/linkmask/main/install.sh | sh
   ```

The script will:
- Detect your device's architecture
- Download the appropriate package
- Install NCLink automatically
- Clean up temporary files

After installation, you can access NCLink through the LuCI web interface under the Services menu.

## Building Custom Packages for Advanced Developers

If you need to build NCLink for a specific architecture not included in the pre-built packages, you can use the provided Docker-based build script to create custom packages.

### Prerequisites for Building
- Linux system with the following packages installed:
  - `make` - Build system
  - `curl` - Download SDKs
  - `tar` - Extract SDK archives
  - `coreutils` (for `realpath`) - Required utility
  - `gcc` and basic build tools
- Git (to clone the repository)
- At least 4GB of free disk space
- Stable internet connection (to download SDKs)

### Available Target Architectures

The build script supports the following OpenWrt target architectures:

| Target | Subtarget | Description |
|--------|-----------|-------------|
| `ramips` | `mt76x8` | MediaTek MT76x8 series routers |
| `ath79` | `generic` | Qualcomm Atheros AR71xx/AR9xxx series |
| `ipq40xx` | `generic` | Qualcomm IPQ40xx series routers |
| `bcm27xx` | `bcm2710` | Broadcom BCM2710 (Raspberry Pi 3/4) |
| `x86` | `64` | x86_64 compatible devices |

### Customizing the Build

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/nasnet-community/linkmask.git
   cd nclink
   ```

2. **Edit the build script** to customize your target architectures:
   ```bash
   nano build-using-openwrt-sdk.sh
   ```

3. **Modify the TARGETS array** in the script:
   ```bash
   TARGETS=(
     "ramips/mt76x8"      # Comment out or remove unwanted targets
     # "ath79/generic"    # Comment out this line to skip this target
     "ipq40xx/generic"    # Keep targets you want to build
     # "bcm27xx/bcm2710" # Comment out this line to skip this target
     "x86/64"             # Keep targets you want to build
   )
   ```

4. **Add custom targets** if needed. To find available targets for your device:
   - Visit [OpenWrt Hardware Selector](https://openwrt.org/toh/start)
   - Search for your device
   - Note the target/subtarget combination (e.g., `targets/mediatek/mt7622/subtargets/MT7622`)

5. **Run the build script**:
   ```bash
   ./build-using-openwrt-sdk.sh
   ```

### Build Process Details

The build script performs the following steps for each target:

1. **Downloads the appropriate OpenWrt SDK** for the target architecture
2. **Extracts the SDK** into a temporary directory
3. **Copies the NCLink package** into the SDK's package directory
4. **Updates and installs feeds** to resolve dependencies
5. **Configures the build** to include the NCLink package
6. **Compiles the package** using the native SDK toolchain
7. **Copies the resulting IPK** to the `packages/` directory

### Output

After successful compilation, you'll find the built packages in the `packages/` directory with names like:
- `luci-app-nclink_1.2-1_ramips_mt76x8.ipk`
- `luci-app-nclink_1.2-1_ath79_generic.ipk`
- `luci-app-nclink_1.2-1_ipq40xx_generic.ipk`
- etc.

### Troubleshooting Build Issues

- **Out of disk space**: Ensure you have at least 4GB free space
- **Network issues**: The script downloads SDKs (~200MB each), ensure stable internet connection
- **Missing dependencies**: Install required packages:
  ```bash
  # Ubuntu/Debian
  sudo apt install make curl tar coreutils build-essential
  
  # CentOS/RHEL/Fedora
  sudo yum install make curl tar coreutils gcc
  ```
- **Architecture not found**: Verify the target/subtarget combination exists in OpenWrt 23.05.3

### Adding New Architectures

To add support for a new architecture:

1. Find the correct target/subtarget from the OpenWrt Hardware Selector
2. Add the target to the `TARGETS` array in `build-using-docker.sh`
3. Test the build process
4. Submit a pull request if the new architecture works correctly

For more information about OpenWrt build system, refer to the [OpenWrt Developer Guide](https://openwrt.org/docs/guide-developer/start).

