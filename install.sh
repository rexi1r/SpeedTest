#!/bin/sh

# Base URL for the packages
BASE_URL="https://raw.githubusercontent.com/nasnet-community/linkmask/main/packages"
UPDATE_URL="https://update.calendar.tv/nclink"
VERSION="1.0"
NCLINK_VERSION_FILE="/.NCLINK"

# Function to detect architecture
detect_arch() {

    # Fallback to uname if /proc/cpuinfo doesn't provide enough info
    local arch=$(uname -m)
    case "$arch" in
        "mipsel")
            echo "mipsel_24kc"
            ;;
        "mips")
            # Test endianness to determine if it's mips or mipsel
            echo -n -e '\x01\x00\x00\x00' > test.bin
            if [ "$(hexdump -e '1/4 "%08x\n"' test.bin)" = "01000000" ]; then
                echo "mips_24kc"
            else
                echo "mipsel_24kc" 
            fi
            rm -f test.bin
            ;;
        "aarch64")
            echo "aarch64_cortex-a53"
            ;;
        "armv7l")
            echo "arm_cortex-a7_neon-vfpv4"
            ;;
        "i686"|"i386"|"x86_64")
            echo "x86_64"
            ;;
        *)
            echo "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

# Function to get device name/ID
get_device_id() {
    # Try to get device name from uci
    local device_name=$(uci get system.@system[0].hostname 2>/dev/null)
    if [ -z "$device_name" ]; then
        # Fallback to hostname
        device_name=$(hostname)
    fi
    echo "$device_name"
}

# Function to check for updates
check_for_updates() {
    local arch=$1
    local device_id=$(get_device_id)
    local update_check_url="${UPDATE_URL}/${VERSION}/${arch}/${device_id}"
    local current_version=$(cat "$NCLINK_VERSION_FILE" 2>/dev/null | grep "^VERSION=" | cut -d'=' -f2)
    
    # Check for updates
    if command -v wget >/dev/null 2>&1; then
        response=$(wget -q -O- "$update_check_url")
    elif command -v curl >/dev/null 2>&1; then
        response=$(curl -s "$update_check_url")
    else
        logger "NCLink: Neither wget nor curl available for update check"
        return 1
    fi

    # Check if response is 200
    if [ "$response" = "200" ]; then
        # Get new version
        if command -v wget >/dev/null 2>&1; then
            new_version=$(wget -q -O- "${update_check_url}/version" | grep "^VERSION=" | cut -d'=' -f2)
        else
            new_version=$(curl -s "${update_check_url}/version" | grep "^VERSION=" | cut -d'=' -f2)
        fi

        if [ -n "$new_version" ] && [ "$new_version" != "$current_version" ]; then
            # Update version file
            echo "VERSION=$new_version" > "$NCLINK_VERSION_FILE"
            logger "NCLink: New version $new_version available"
        else
            logger "NCLink: System is up to date (version $current_version)"
        fi
    else
        logger "NCLink: Update check failed with response: $response"
    fi
}

# Function to setup update cron job
setup_update_cron() {
    local arch=$1
    # Create update script
    cat > /usr/bin/nclink-update.sh << 'EOF'
#!/bin/sh
ARCH="$1"
check_for_updates "$ARCH"
EOF

    chmod +x /usr/bin/nclink-update.sh

    # Add cron job if it doesn't exist
    if ! crontab -l | grep -q "nclink-update.sh"; then
        (crontab -l 2>/dev/null; echo "0 * * * * /usr/bin/nclink-update.sh $arch") | crontab -
        logger "NCLink: Update cron job installed"
    fi
}

# Function to download and install package
install_package() {
    local arch=$1
    local package_name="luci-app-nclink_${VERSION}-1_${arch}.ipk"
    local package_url="${BASE_URL}/${package_name}"
    local tmp_file="/tmp/${package_name}"

    echo "Detected architecture: $arch"
    echo "Downloading package: $package_name"

    # Try wget first, fall back to curl if wget is not available
    if command -v wget >/dev/null 2>&1; then
        wget -q -O "$tmp_file" "$package_url"
    elif command -v curl >/dev/null 2>&1; then
        curl -s -o "$tmp_file" "$package_url"
    else
        echo "Error: Neither wget nor curl is available, please run 'opkg update && opkg install curl' and try again"
        exit 1
    fi

    if [ ! -f "$tmp_file" ]; then
        echo "Error: Failed to download package"
        exit 1
    fi

    echo "Updating package lists..."
    opkg update

    echo "Installing package..."
    opkg install "$tmp_file"

    # Clean up
    rm -f "$tmp_file"
}

# Main installation process
echo "Starting NCLink installation..."

# Detect architecture
ARCH=$(detect_arch)
if [ $? -ne 0 ]; then
    echo "Error: $ARCH"
    exit 1
fi

# Install the package
install_package "$ARCH"

# Setup update checking
setup_update_cron "$ARCH"

# Create initial version file
echo "VERSION=$VERSION" > "$NCLINK_VERSION_FILE"

echo "Installation completed!" 