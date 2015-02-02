#!/usr/bin/env tcsh


module load NL/TOOLKITS/UIUCSRL/2.0


setenv UIUC_DIR /cs/natlang-sw/Linux-x86_64/NL/TOOLKITS/UIUCSRL/2.0/
cd $UIUC_DIR/CharniakServer
nohup ./charniak-server.pl > charniak-server.log &
cd $UIUC_DIR/bin
./start-server.sh
