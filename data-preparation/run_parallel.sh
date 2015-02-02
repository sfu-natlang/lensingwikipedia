#!/bin/bash


date=`date +%Y%m%d`                                             #get date from machine
echo $date
W_DIR=/cs/natlang-projects/users/maryam/wikiCrawler/Crawl_$date
SCRIPT_DIR=/home/msiahban/testSVN/lensingwikipedia/data-preparation/
args_file=$SCRIPT_DIR/data/date_spans.txt
code_file=$SCRIPT_DIR/tcsh_script.sh

tcsh $SCRIPT_DIR/srl_server.sh

mkdir -p $W_DIR
cd $W_DIR

while read -r line
do
    myargs=$line
    arrIN=(${myargs//;/ })
    echo ${arrIN[0]}
    echo ${arrIN[1]}
    tcsh $code_file $SCRIPT_DIR/dataPrepration.sh $W_DIR/Crawl ${arrIN[0]} ${arrIN[1]} &
done < "$args_file"


counter=1
#failed_jobids
Failed=""
seperator=" "
for job in `jobs -p`
do
echo $job
    wait $job || Failed=$Failed$seperator$counter$seperator
    #;echo "Part "+counter+" Failed."
    counter=$((counter+1))
done


while read -r line
do
    myargs=$line
    arrIN=(${myargs//;/ })
    dataPart=$W_DIR/Crawl_${arrIN[0]}_${arrIN[1]}/fullData.json
    if [ -f $dataPart ];
    then
    cat $dataPart >> $W_DIR/fullData.json
    else
    echo "Error!!!: $dataPart does not exist. exit!"
    rm $W_DIR/fullData.json
    exit
    fi
done < "$args_file"

exit

if [ "$Failed" == "" ];
then
echo "YAY!"
else
echo "FAIL! in these rows ($Failed)"
fi
