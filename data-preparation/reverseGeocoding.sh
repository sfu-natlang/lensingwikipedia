#!/bin/bash

PYPATH=/cs/natlang-sw/Linux-x86_64/NL/LANG/PYTHON/2.7.3/bin/python

nloc=`wc -l txturl2latlong.txt | cut -d' ' -f1`
nquery=2490
nday=`echo "$nloc / $nquery" | bc`

log=locFilesLog
mkdir -p $log
for (( i=0; i<$nday; i++ )); do
     let s="i * $nquery + 1"
     let t="( i + 1 ) * $nquery"
     sed -n "${s},${t}p" txturl2latlong.txt > $log/loc.$i
     lastInd=$i
     $PYPATH callGoogle.py $log/loc.$i $log/loc.$i.out
     echo "step $i" 
     let waiting="24 * 3600"
     sleep $waiting 
done
let tot="$nday * $nquery"
let remaining="$nloc - $tot"
let lastInd="$lastInd + 1"
#echo $remaining
if [ $remaining -gt 0 ]; then 
	tail -$remaining txturl2latlong.txt > $log/loc.$lastInd 
	let nday="$nday + 1"
fi
#if [ $remaining -gt 0 ]; then let nday="$nday + 1"; fi
#echo $nday

