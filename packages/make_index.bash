#!/bin/sh

> Packages  # Start fresh

for ipk in *.ipk; do
  echo "Generating entry for: $ipk"
  
  tar -xzOf "$ipk" ./control.tar.gz | tar -xzO ./control >> Packages
  echo "" >> Packages
done

gzip -k Packages  # Creates Packages.gz too

