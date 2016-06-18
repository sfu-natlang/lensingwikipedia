#!/bin/bash
set -e

source ./config.env

HOST=$LENSING_SITE_URL

BUILD_DIR=./keys
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

print_help() {
    echo "./gen_keys ca       Generate a CA key and certificate"
    echo "./gen_keys server   Generate server key+cert"
    echo "./gen_keys client   Generate client key+cert"
    echo "./gen_keys help     Print this help message"
}

gen_ca() {
    echo
    echo "--- Generating CA private key: $CA_KEY"
    echo
    openssl genrsa -aes256 -out $CA_KEY 4096

    echo
    echo "--- Generating CA certificate: $CA_CERT"
    echo
    openssl req -subj "/CN=$HOST" -new -x509 -days 365 -key $CA_KEY -sha256 -out $CA_CERT

    chmod -v 0400 $CA_KEY
    chmod -v 0444 $CA_CERT
}

gen_server() {
    if ! [ -f $CA_KEY -a -f $CA_CERT ]; then
        echo "CA key and/or cert missing! Run './gen_keys.sh ca' first."
        exit 1
    fi

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

    rm $SERVER_CSR $EXT_FILE
    chmod -v 0400 $SERVER_KEY
    chmod -v 0444 $SERVER_CERT
}

gen_client() {
    if ! [ -f $CA_KEY -a -f $CA_CERT ]; then
        echo "CA key and/or cert missing! Run './gen_keys.sh ca' first."
        exit 1
    fi

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

    rm $CLIENT_CSR $EXT_FILE
    chmod -v 0400 $CLIENT_KEY
    chmod -v 0444 $CLIENT_CERT
}

instructions() {
    echo
    echo "-----------------------------------------------------------------"
    echo "Now you need to run the following commands on your local machine:"
    echo
    echo "  scp $CA_CERT $HOST:/etc/docker/ca.pem"
    echo "  scp $SERVER_CERT $HOST:/etc/docker/server-cert.pem"
    echo "  scp $SERVER_KEY $HOST:/etc/docker/server-key.pem"

    echo

    echo "Make sure that your docker daemon is passed the following parameters"
    echo "(in /etc/sysconfig/docker):"
    echo
    echo "  --tlsverify --tlscacert=/etc/docker/ca.pem --tlscert=/etc/docker/server-cert.pem --tlskey=/etc/docker/server-key.pem -H=$HOST:2376"

    echo
    echo "Keep the keys around so you can sign more clients if needed"
    echo
}

if [ -z $1 ]; then
    echo "Invalid command."
    echo "Type ./gen_keys.sh help for help information"
elif [ $1 = "help" ]; then
    print_help
    exit 0
elif [ $1 = "ca" ]; then
    if [ -f $CA_KEY ]; then
        echo "$CA_KEY already exists."
    elif [ -f $CA_CERT ]; then
        echo "$CA_CERT already exists."
    else
        gen_ca
        exit 0
    fi
elif [ $1 = "server" ]; then
    if [ -f $SERVER_KEY ]; then
        echo "$SERVER_KEY already exists."
    elif [ -f $SERVER_CERT ]; then
        echo "$SERVER_CERT already exists."
    else
        gen_server
        instructions
        exit 0
    fi
elif [ $1 = "client" ]; then
    if [ -f $CLIENT_KEY ]; then
        echo "$CLIENT_KEY already exists."
    elif [ -f $CLIENT_CERT ]; then
        echo "$CLIENT_CERT already exists."
    else
        gen_client
        exit 0
    fi
elif [ $1 = "instructions" ]; then
    instructions
    exit 0
else
    echo "Invalid command."
    echo "Type ./gen_keys.sh help for help information"
fi
