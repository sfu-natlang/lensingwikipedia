spider for lensingwikipedia
===========================

These are scripts for crawling Wikipedia:

* eventSpider.py: crawl all history articles from Wiki from 'startYear' to 'endYear' and store them in 'outDir' (each year as a separate folder). For example from 1500BC to 2015:
``` 
scrapy runspider -a outDir=1500BC-2015 -a endYear='-1500' -a startYear='2015' eventSpiderSplit.py
```

* entitySpider.py  

* nerLocSpider.py  

* nerOrgSpider.py

* nerPersonSpider.py 
