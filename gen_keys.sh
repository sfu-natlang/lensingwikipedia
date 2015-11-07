#!/bin/bash
set -e

source ./config.env

HOST=$LENSING_SITE_URL

BUILD_DIR=./build/keys
mkdir -p $BUILD_DIR

CA_KEY=$BUILD_DIR/ca-key.pem
CA_CERT=$BUILD_DIR/ca.pem

EXT_FILE=$BUILD_DIR/extfile.cnf

SERVER_KEY=$BUILD_DIR/server-key.pem
SERVER_CSR=$BUILD_DIR/server.csr
SERVER_CERT=$BUILD_DIR/server-cert.pem

CLIENT_KEY=$BUILD_DIR/key.pem
CLIENT_CSR=$BUILD_DIR/client.csr
CLIENT_CERT=$BUILD_DIR/cert.pem

mkdir -p $BUILD_DIR

echo
echo "!!! MAKE SURE THAT 'Common Name' IS $HOST"
echo

echo
echo "--- Generating CA private key: $CA_KEY"
echo
openssl genrsa -aes256 -out $CA_KEY 4096

echo
echo "--- Generating CA certificate: $CA_CERT"
echo
openssl req -subj "/CN=$HOST" -new -x509 -days 365 -key $CA_KEY -sha256 -out $CA_CERT

echo
echo "--- Generating server private key: $SERVER_KEY"
echo
openssl genrsa -out $SERVER_KEY 4096

echo
echo "--- Generating CSR: $SERVER_CSR"
echo
openssl req -subj "/CN=$HOST" -sha256 -new -key $SERVER_KEY -out $SERVER_CSR

echo subjectAltName = IP:127.0.0.1 > $EXT_FILE

echo
echo "--- Generating server certificate: $SERVER_CERT"
echo
openssl x509 -req -days 365 -sha256 -in $SERVER_CSR \
    -CA $CA_CERT -CAkey $CA_KEY -CAcreateserial \
    -out $SERVER_CERT -extfile $EXT_FILE

echo
echo "--- Generating client key: $CLIENT_KEY"
echo
openssl genrsa -out $CLIENT_KEY 4096

echo
echo "--- Generating client CSR: $CLIENT_CSR"
echo
openssl req -subj '/CN=client' -new -key $CLIENT_KEY -out $CLIENT_CSR

echo extendedKeyUsage = clientAuth > $EXT_FILE

echo
echo "--- Signing client certificate: $CLIENT_CERT"
echo
openssl x509 -req -days 365 -sha256 -in $CLIENT_CSR \
    -CA $CA_CERT -CAkey $CA_KEY -CAcreateserial \
    -out $CLIENT_CERT -extfile $EXT_FILE

rm -v $CLIENT_CSR $CSR

chmod -v 0400 $CA_KEY $SERVER_KEY $CLIENT_KEY
chmod -v 0444 $CA_CERT $SERVER_CERT $CLIENT_CERT

echo
echo "--- Now you need to run the following commands"
echo "--- on your local machine:"
echo "cp $CA_CERT ~/.docker/ca.pem"
echo "cp $CLIENT_KEY ~/.docker/key.pem"
echo "cp $CLIENT_CERT ~/.docker/cert.pem"
echo "scp $CA_CERT $HOST:/root/.docker/ca.pem"
echo "scp $SERVER_CERT $HOST:/root/.docker/server-cert.pem"
echo "scp $SERVER_KEY $HOST:/root/.docker/server-key.pem"

echo

echo "--- Now make sure that your docker daemon is"
echo "--- passed the following parameters (in /etc/sysconfig/docker):"
echo "--tlsverify --tlscacert=/root/.docker/ca.pem --tlscert=/root/.docker/server-cert.pem --tlskey=/root/.docker/server-key.pem"

echo
echo "--- Keep the keys around so you can sign more clients if needed"
echo
