#!/bin/bash
set -e

PACKAGE_NAME="luci-app-nclink"
PACKAGE_DIR="$(pwd)/package/$PACKAGE_NAME"
OUTPUT_DIR="$(pwd)/packages"
OPENWRT_VERSION="23.05.5"

TARGETS=(
  "ramips/mt76x8"
  "ath79/generic"
  "ipq40xx/generic"
  "bcm27xx/bcm2710"
  "x86/64"
)

if ! command -v realpath &>/dev/null; then
  echo "❌ 'realpath' is required but not installed. Please install it (e.g. sudo apt install coreutils)."
  exit 1
fi


mkdir -p "$OUTPUT_DIR"
mkdir -p sdk-workdir

for T in "${TARGETS[@]}"; do
  TARGET=$(echo "$T" | cut -d'/' -f1)
  SUBTARGET=$(echo "$T" | cut -d'/' -f2)
  SDK_NAME="openwrt-sdk-${OPENWRT_VERSION}-${TARGET}-${SUBTARGET}_gcc-12.3.0_musl.Linux-x86_64"
  if [ "$TARGET" == "ipq40xx" ]; then
    SDK_NAME="openwrt-sdk-${OPENWRT_VERSION}-${TARGET}-${SUBTARGET}_gcc-12.3.0_musl_eabi.Linux-x86_64"
  fi
  SDK_TARBALL="${SDK_NAME}.tar.xz"
  SDK_URL="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/${SUBTARGET}/${SDK_TARBALL}"
  SDK_DIR="sdk-workdir/${SDK_NAME}"

  echo "🔄 Processing $TARGET/$SUBTARGET..."

  # Download and extract SDK if not already
  if [ ! -d "$SDK_DIR" ]; then
    echo "📥 Downloading SDK: $SDK_URL"
    mkdir -p sdk-workdir
    curl -L -o "sdk-workdir/$SDK_TARBALL" "$SDK_URL"
    echo "📦 Extracting SDK..."
    tar -C sdk-workdir -xf "sdk-workdir/$SDK_TARBALL"
  fi

  # Copy your package into the SDK
  cp -r "$PACKAGE_DIR" "$SDK_DIR/package/"

  # Build using the native SDK
  cd "$SDK_DIR"
  ./scripts/feeds update -a > /dev/null
  ./scripts/feeds install -a > /dev/null

  echo "CONFIG_PACKAGE_$PACKAGE_NAME=y" >> .config
  make defconfig
  make package/$PACKAGE_NAME/compile -j$(nproc)
  cd - > /dev/null

  # Copy resulting IPKs to output
  find "$SDK_DIR/bin/packages/" -name "${PACKAGE_NAME}_*.ipk" -exec cp {} "$OUTPUT_DIR" \;
done

echo "✅ All builds complete. IPKs are in $OUTPUT_DIR"
