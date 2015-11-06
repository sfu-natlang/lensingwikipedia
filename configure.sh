#!/bin/bash
set -e
source ./config.env

if [ -z "${INDEX_PATH}" ]; then
    echo "INDEX_PATH is not set (or blank)"
    echo "Please set it in config.env"
    exit 1
fi

rm -rf ./build
mkdir -p ./build/index

echo "Copying index to build/index"
cp -r "${INDEX_PATH}"/* ./build/index
