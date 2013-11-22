#!/bin/bash

W_DIR=/cs/natlang-projects/users/maryam/wikiCrawler/Crawl_20131102
NER_HOME=/cs/natlang-projects/users/maryam/clustering/NERStanford
UIUC_Dir=/cs/natlang-sw/Linux-x86_64/NL/TOOLKITS/UIUCSRL/2.0/
PYPATH=/cs/natlang-sw/Linux-x86_64/NL/LANG/PYTHON/2.7.3/bin/python
CORENLP=/cs/natlang-projects/users/maryam/codes/stanford-corenlp-full-2013-06-20
SCRIPT_PATH=/cs/natlang-projects/users/maryam/wikiCrawler

DUMP_Dir=$W_DIR/Dump_20131102		#TODO: get date from machine
#module load NL/LANG/PYTHON/2.7.3
#module load NL/TOOLKITS/UIUCSRL/2.0

mkdir -p $W_DIR
cd $W_DIR

### STEP 1: crawling the main domain ###
########################################
echo "Running eventSpider to crawl wiki articles"
scrapy runspider -a outDir=$DUMP_Dir -a endYear='2013' $SCRIPT_PATH/spiders/eventSpider.py

### STEP 2: Running CORENLP ###
###############################

echo "Running coreNLP on all files in Dump dir"


for dir in $(find $DUMP_Dir -mindepth 1 -type d); do
	java -cp $CORENLP/stanford-corenlp-3.2.0.jar:$CORENLP/stanford-corenlp-3.2.0-models.jar:$CORENLP/xom.jar:$CORENLP/joda-time.jar:$CORENLP/jollyday.jar -Xmx3g edu.stanford.nlp.pipeline.StanfordCoreNLP -annotators tokenize,ssplit,pos,lemma,ner,parse,dcoref -filelist $dir/path.txt -outputDirectory $dir -outputExtension .xml -replaceExtension 
done

rm newJ.json
rm outCoRef.txt
rm NER.loc
rm NER.per
rm NER.tok
rm NER.org

echo "Extracting locations recognized by NER (\"locFromNER.txt\") and tokenized descriptions (\"eventDescription.ner.tok\") to run SRL"
for dir in $(find $DUMP_Dir -mindepth 1 -type d); do
	$PYPATH $SCRIPT_PATH/coRefResolution.py $dir NER newJ.json >> outCoRef.txt
done


#NER.tok:	each line is one event (tokenized)
#NER.loc: 		each line is a location predicted by NER
#NER.per: 		each line is a person predicted by NER



### STEP 3: Extract location inforamtion ###
############################################

cd $W_DIR

echo "Running locationSpider to crawl all links and specified locations"
scrapy runspider -a infile='newJ.json' -a outfile='url.json' -a outfileLoc='location.json' -a outfilePer='person.json' $SCRIPT_PATH/spiders/entitySpider.py
echo "Running nerLocSpider to crawl corresponding wiki articles and recognize locations"
scrapy runspider -a infile='NER.loc' -a outfile='locFromNER.json' $SCRIPT_PATH/spiders/nerLocSpider.py
echo "Running nerPersonSpider to crawl corresponding wiki articles and recognize persons"
scrapy runspider -a infile='NER.per' -a outfile='perFromNER.json' $SCRIPT_PATH/spiders/nerPersonSpider.py

echo "Combining all location information (from NER and wiki links in descriptions)"
$PYPATH $SCRIPT_PATH/makeLocationDict.py location.json locFromNER.json txturl2latlong.json
#locationDictionary.txt: is a dictionary file from url or text to latitude longtitue. the format of each line is:
#[text|url]\tlatitude , longtitude

echo "Combining all person information (from NER and wiki links in descriptions)"
$PYPATH $SCRIPT_PATH/makePersonDict.py person.json perFromNER.json personDictionary.json
#personDictionary.txt: is a dictionary file from url or text to name (of person). the format of each line is:
#[text|url]\tPersonName

exit

### STEP 4: Reverse Geocoding ###
#################################

# We use google geocoding (reverseGeocoding.sh) which currently has a limitation on the number of queries per day.
# Therefore you should run it seperately and prepare a file contains all locations ("locationDictionary.json") 
#using txturl2latlong.txt, and use it to prepare final json file.

$PYPATH $SCRIPT_PATH/findNewLocations.py txturl2latlong.json locationDictionary.json newLocations.json

sh $SCRIPT_PATH/reverseGeocoding.sh newLocations.json

if [ -f locationDictionary.json.cln ] && [ -f newLocationsCountry.json ];
then
cat locationDictionary.json.cln > locationDictionary.json
cat newLocationsCountry.json >> locationDictionary.json
else
echo "err in preparing locationDictionary.json"
fi

### STEP 5: Running SRL ###
###########################

echo "Running UIUC SRL: input:eventDescription.ner.tok output:eventDescription.ner.tok.srl"

# Uncomment following lines to run the server

#cd $UIUC_DIR/CharniakServer
#nohup ./charniak-server.pl > charniak-server.log &
#cd $UIUC_DIR/bin
#./start-server.sh

cd $UIUC_DIR/bin
perl srl-client-primitive.pl 0 0 $W_DIR/NER.tok  $W_DIR/descriptions.srl


### STEP 6: Prepare json file ###
#################################

cd $W_DIR

echo "Writing the final json file"

$PYPATH prepareJson.py descriptions.srl locationDictionary.json personDictionary.json url.json newJ.json fullData.json
