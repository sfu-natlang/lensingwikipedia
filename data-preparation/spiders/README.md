spiders for lensingwikipedia
===========================

These are scripts for crawling Wikipedia:

* ```eventSpider.py```: crawl all history articles from Wiki from 'startYear' to 'endYear' and store them in 'outDir' (each year as a separate folder). For example from 1500BC to 2015:
``` 
scrapy runspider -a outDir=1500BC-2015 -a endYear='-1500' -a startYear='2015' eventSpiderSplit.py
```

* ```entitySpider.py```: crawl all wikipedia pages (embedded in history articles). This crawler investigates each article, identifies person, location and organizations and save them in separate json files (given as arguments). 
```
scrapy runspider -a infile='events.json' -a outfile='url.json' -a outfileLoc='location.json' -a outfilePer='person.json' -a outfileOrg='organization.json' entitySpider.py
```

It gets the input (list of links to wikipedia) as a json file. Note that each line is a json entry with key: "urls". Value of this key is a list of hyperlinks in an history event (crawled by ```eventSpider.py```). (Note that just "urls" is required by ```entitySpider.py```). 
These are examples of entries in input and output files. 
Each entry in the output files has three keys: "url" url of article in wikipedia; "text": a list of substrings in the events that referred to this entity (has hyperlink to the corresponding article); "title": tile of article (the title is shown in facets in wikipedia).
Format of output files are similar, except that location entries have "latitude" and "longitude" keys as well. 

```
A line of events.json:
{
    "description": "The element Mercury has been discovered in Egyptian tombs dating from this decade.", 
    "html_fragment": "The element <a href=\"/wiki/Mercury_(element)\" title=\"Mercury (element)\">Mercury</a> has been discovered in <a href=\"/wiki/Egypt\" title=\"Egypt\">Egyptian</a> tombs dating from this decade.", 
    "ner_info": {"person": [], "locations": [], "organization": []}, 
    "header": "", 
    "urls": [["/wiki/Mercury_(element)", "Mercury"], ["/wiki/Egypt", "Egyptian"]], 
    "year": "1500_BC"
}

A line of location.json:
{
    "latitude": "30\u00b02\u2032N", 
    "text": ["Egypt", "Egyptians", "Egyptian"], 
    "url": "/wiki/Egypt", 
    "longitude": "31\u00b013\u2032E", 
    "title": "Egypt"
}

A line of person.json:
{
    "url": "/wiki/Artemisia_II_of_Caria", 
    "text": ["Artemisia", "Artemisia II"], 
    "title": 
    "Artemisia II of Caria"
}
```

* ```nerLocSpider.py```, ```nerOrgSpider.py```, ```nerPersonSpider.py```: these scripts search for articles correspond to a list of entities, if there exists any, and save the information like output of ```entitySpider.py```. Input file is a list of entities (person, location or organization), one entity per line. (The input files are entities identified by NER system.)

```
scrapy runspider -a infile='NER.loc' -a outfile='locFromNER.json' nerLocSpider.py
scrapy runspider -a infile='NER.per' -a outfile='perFromNER.json' nerPersonSpider.py
scrapy runspider -a infile='NER.org' -a outfile='orgFromNER.json' nerOrgSpider.py
```
