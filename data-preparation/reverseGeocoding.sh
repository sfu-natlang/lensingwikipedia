#!/bin/bash

PYPATH=/cs/natlang-sw/Linux-x86_64/NL/LANG/PYTHON/2.7.3/bin/python
SCRIPTS=/cs/natlang-projects/users/maryam/wikiCrawler

fileName=$1


nloc=`wc -l $fileName | cut -d' ' -f1`
nquery=2490
nday=`echo "$nloc / $nquery" | bc`

log=locFilesLog
mkdir -p $log
rm $log/*
for (( i=0; i<$nday; i++ )); do
     let s="i * $nquery + 1"
     let t="( i + 1 ) * $nquery"
     sed -n "${s},${t}p" $fileName > $log/loc.$i
     lastInd=$i
     $PYPATH $SCRIPTS/reGeocoding.py $log/loc.$i $log/loc.$i.out
     echo "step $i" 
     let waiting="24 * 3600"
     sleep $waiting 
done
lastInd=$i
let tot="$nday * $nquery"
let remaining="$nloc - $tot"
#let lastInd="$lastInd + 1"
if [ $remaining -gt 0 ]; then 
	tail -$remaining $fileName > $log/loc.$lastInd 
	let nday="$nday + 1"
     	$PYPATH $SCRIPTS/reGeocoding.py $log/loc.$lastInd $log/loc.$lastInd.out
fi
#if [ $remaining -gt 0 ]; then let nday="$nday + 1"; fi
#echo $nday


if [ -f $log/loc.0.out ];
then 
cat $log/loc.0.out > newLocationsCountry.json
else
echo -n "" > newLocationsCountry.json
fi


for (( i=1; i<$nday; i++ )); do
	cat $log/loc.$i.out >> newLocationsCountry.json
done
