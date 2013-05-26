from scrapy.spider import BaseSpider
from scrapy.selector import HtmlXPathSelector
from scrapy.contrib.spiders import CrawlSpider, Rule
from scrapy.contrib.linkextractors.sgml import SgmlLinkExtractor
import json
import codecs

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
		self.readFile(self.inFile)
		fout = codecs.open(self.outFile,"w", encoding='utf-8')
		fout.close
	
	def readFile(self, fileName):
		fout = open(fileName,"r")
		startingAdd1 = "http://en.wikipedia.org/wiki/"
		for line in fout:
			items = line[:-1].split(" ")
			header = startingAdd1+"_".join(items)
			if header not in self.url2locDic:
				self.start_urls.append(header)
			self.url2locDic[header] = line[:-1]

		fout.close

	def parse(self, response):
		url = response.url
		fout = codecs.open(self.outFile,"a", encoding='utf-8')
		ptr = HtmlXPathSelector(response)
		ulDict = {}
		h1 = ptr.select('//h1/span')
		title = h1[0].select('descendant::text()').extract()[0].encode('utf8','ignore')
		spans = ptr.select('//span')
		latFlag = 0
		location = {}
		location['title'] = title
		for span in spans:
			classes = span.select('@class').extract()
			class_name = str(classes[0]) if len(classes) > 0 else ''
		
			if class_name == 'latitude':
				latitude=span.select('text()').extract()[0].encode('utf8','ignore')
				latFlag = 1
			elif latFlag and class_name == 'longitude':
				longitude=span.select('text()').extract()[0].encode('utf8','ignore')
				location['latitude'] = latitude
				location['longitude'] = longitude
				try:
					text = self.url2locDic[url]
					location['text'] = text
					location['url'] = "/wiki/"+"_".join(text.split())
					
				except:
					startingAdd1 = "http://en.wikipedia.org"
					location['url'] = "/wiki/"+url[len(startingAdd1):]
					location['text'] = " ".join(url[len(startingAdd1)+6:].split("_"))
				print >> fout, json.dumps(location)
				break

		fout.close

