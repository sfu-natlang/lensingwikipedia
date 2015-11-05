#!/bin/bash
source config.env

rm -rf build
mkdir -p build/index

echo "Copying index to build/index"
cp -r "${INDEX_PATH}"/* build/index
