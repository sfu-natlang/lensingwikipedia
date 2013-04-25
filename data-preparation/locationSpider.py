from scrapy.spider import BaseSpider
from scrapy.selector import HtmlXPathSelector
from scrapy.contrib.spiders import CrawlSpider, Rule
from scrapy.contrib.linkextractors.sgml import SgmlLinkExtractor

#from django.utils.encoding import smart_str

class locationSpider(BaseSpider):
	name = "locationSpider"
	allowed_domains = ["en.wikipedia.org"]
	inFile=""
	outFile=""
	def __init__(self, **kwargs):
		BaseSpider.__init__(self)
		startingAdd = "http://en.wikipedia.org/wiki/"
		self.inFile=kwargs['infile']
		self.outFile=kwargs['outfile']
		self.start_urls = []
		self.url2locDic = {}
		self.url2urlDic = {}
		self.readFile(self.inFile)
		fout = open(self.outFile,"w")
		fout.close
	
	def readFile(self, fileName):
		fout = open(fileName,"r")
		startingAdd1 = "http://en.wikipedia.org/wiki/"
		startingAdd2 = "http://en.wikipedia.org"
		for line in fout:
			items = line[:-1].split("\t")
			try:
				header = startingAdd1+ items[1]
			except:
				print line
				print items
				continue
			if header not in self.url2urlDic:
				self.start_urls.append(header)
				self.url2locDic[header] = set()
				self.url2locDic[header].add(items[1])
				self.url2urlDic[header] = "/wiki/"+items[1]
			else:
				self.url2locDic[header].add(items[1])
			if len(items) <= 3:
				continue
			for k in items[3:-1]:
				splitted=k.split()
				add = startingAdd2+splitted[0]
				if add not in self.url2urlDic:
					self.start_urls.append(add)
					self.url2locDic[add] = set()
					self.url2locDic[add].add(" ".join(splitted[1:]))
					self.url2urlDic[add] = splitted[0]
				else:
					self.url2locDic[add].add(" ".join(splitted[1:]))

		fout.close

	def parse(self, response):
		url = response.url
		fout = open(self.outFile,"a")
		ptr = HtmlXPathSelector(response)
		ulDict = {}
		spans = ptr.select('//span')
		latFlag = 0
		for span in spans:
			classes = span.select('@class').extract()
			class_name = str(classes[0]) if len(classes) > 0 else ''
			
			if class_name == 'latitude':
				latitude=span.select('text()').extract()[0].encode('utf8','ignore')
				latFlag = 1
			elif latFlag and class_name == 'longitude':
				longitude=span.select('text()').extract()[0].encode('utf8','ignore')
				location = "\t".join(self.url2locDic[url])
				urlPost=self.url2urlDic[url]
				fout.write("%s\t%s , %s\t%s\n" %(urlPost,latitude,longitude,location))
				break

		fout.close



