#!/bin/bash
set -e

# Check for required tools
for cmd in ar tar gzip; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Required tool '$cmd' is not installed."
        echo "Please install it using: sudo apt-get install $cmd"
        exit 1
    fi
done

PACKAGE="luci-app-nclink"
# Ensure these are the correct target/subtarget combinations for your OpenWrt version
TARGETS=(
  "ath79/generic"
  "ramips/mt76x8"
  "ipq40xx/generic"
  "bcm27xx/bcm2710"
  "x86/generic"
)

CPU_CORES=$(nproc) # Use all available CPU cores for faster compilation

# Navigate to the OpenWrt root directory
# (Assuming the script is run from the OpenWrt root or you adjust this path)
OPENWRT_ROOT=$(pwd)

# Make sure feeds are updated and installed once
echo "Updating and installing feeds..."
./scripts/feeds update -a
./scripts/feeds install -a
echo "Feeds updated and installed."

for T in "${TARGETS[@]}"; do
  TARGET=$(echo "$T" | cut -d/ -f1)
  SUBTARGET=$(echo "$T" | cut -d/ -f2)
  echo "============================================"
  echo "Building $PACKAGE for $TARGET/$SUBTARGET"
  echo "============================================"

  # 1. Clean previous build artifacts (important for a fresh start per target)
  make dirclean # More thorough clean than distclean, especially for target changes
  
  # 2. Create base .config for the target and your package
  # We'll use a temporary .config file and then merge it
  cat > "${OPENWRT_ROOT}/.config.tmp" <<EOF
CONFIG_TARGET_$TARGET=y
CONFIG_TARGET_${TARGET}_$SUBTARGET=y
CONFIG_PACKAGE_$PACKAGE=y
# Essential LuCI dependencies for a LuCI app
CONFIG_PACKAGE_luci=y               # Enables the main LuCI package and its dependencies
CONFIG_PACKAGE_luci-base=y
CONFIG_PACKAGE_luci-lib-nixio=y
CONFIG_PACKAGE_luci-lib-ip=y
CONFIG_PACKAGE_luci-lib-jsonc=y     # Often a dependency for LuCI apps
CONFIG_PACKAGE_luci-lib-httpclient=y # Often a dependency for LuCI apps
CONFIG_PACKAGE_luci-theme-bootstrap=y
CONFIG_PACKAGE_libuci=y
CONFIG_DEVEL=y
# You might need to add other common libraries if your package implicitly depends on them
# For example:
# CONFIG_PACKAGE_libpthread=y
# CONFIG_PACKAGE_librt=y
# CONFIG_PACKAGE_libstdcpp=y
EOF

  # Merge the temporary config with a default OpenWrt config
  # This ensures all necessary toolchain, kernel, and base system packages are selected
  cp "${OPENWRT_ROOT}/.config.tmp" "${OPENWRT_ROOT}/.config"
  make defconfig
  rm "${OPENWRT_ROOT}/.config.tmp" # Clean up temporary config

  # 3. Build the entire OpenWrt image (or at least the toolchain and dependencies)
  # For LuCI packages, it's often easiest to do a 'make' as the LuCI dependencies
  # are built as part of the image.
  # We will build the entire OpenWrt image, then extract your package.
  echo "Starting full OpenWrt build for $TARGET/$SUBTARGET..."
  make -j$CPU_CORES V=s # V=s for verbose output
  
  # 4. Check for the built package
  # Search through all package repositories to find the IPK
  IPK_FILE=$(find "${OPENWRT_ROOT}/bin/packages" -name "${PACKAGE}_*.ipk" 2>/dev/null | head -n 1)

  if [ -f "$IPK_FILE" ]; then
    echo "✅ Successfully built $PACKAGE for $TARGET/$SUBTARGET. IPK: $IPK_FILE"
    # Optional: Copy the IPK to a central output directory
    mkdir -p "${OPENWRT_ROOT}/built_ipks"
    cp "$IPK_FILE" "${OPENWRT_ROOT}/built_ipks/"
  else
    echo "❌ Failed to find IPK for $PACKAGE for $TARGET/$SUBTARGET."
    echo "Please check the build logs for errors."
    exit 1
  fi
done

# Generate Packages.gz in the built_ipks folder
echo "Generating Packages.gz index..."
cd "${OPENWRT_ROOT}/built_ipks"
find . -name "*.ipk" -type f -exec sh -c 'ar p {} control.tar.gz | tar xzO ./control' \; > Packages
gzip -f Packages
echo "✅ Packages.gz generated successfully"

echo "All specified targets processed. Built IPKs are in ${OPENWRT_ROOT}/built_ipks/"