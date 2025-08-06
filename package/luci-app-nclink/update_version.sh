#!/bin/bash

# Script to update version numbers in template files
# This should be run before building the package
# it will update the version in the template files based on the Makefile, this function is used if the auto versioning is not working

# Get version from Makefile
VERSION=$(grep "PKG_VERSION:=" Makefile | cut -d'=' -f2 | tr -d ' ')

if [ -z "$VERSION" ]; then
    echo "Error: Could not find PKG_VERSION in Makefile"
    exit 1
fi

echo "Updating version to $VERSION in template files..."

# Update version in template files
find luasrc/view -name "*.htm" -type f | while read file; do
    echo "Updating $file..."
    # Replace hardcoded version numbers with dynamic version
    sed -i "s/v=[0-9]\+\.[0-9]\+/v=$VERSION/g" "$file"
    sed -i "s/v='[0-9]\+\.[0-9]\+'/v='$VERSION'/g" "$file"
done

echo "Version update complete!" 