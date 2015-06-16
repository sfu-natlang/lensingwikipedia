#!/usr/bin/env tcsh


#module load NL/LANG/PYTHON/2.7.3
module load NL/TOOLKITS/UIUCSRL/2.0
module load NL/LANG/PYTHON/Anaconda-2.1.0
module unload NL/LANG/PYTHON/2.6.2

#which python
#module list

bash "$1" "$2" "$3" "$4"
