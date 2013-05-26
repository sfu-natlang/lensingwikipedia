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
	outFileLoc=""
	outFilePer=""
	def __init__(self, **kwargs):
		BaseSpider.__init__(self)
		startingAdd = "http://en.wikipedia.org/wiki/"
		self.inFile=kwargs['infile']
		self.outFileLoc=kwargs['outfileLoc']
		self.outFilePer=kwargs['outfilePer']
		self.start_urls = []
		self.url2locDic = {}
		self.url2urlDic = {}
		self.readFile(self.inFile)
		fout = open(self.outFileLoc,"w")
		fout = open(self.outFilePer,"w")
		fout.close
	
	def readFile(self, fileName):
		fin = open(fileName,"r")
		startingAdd1 = "http://en.wikipedia.org/wiki/"
		startingAdd2 = "http://en.wikipedia.org"
		#fout = open("urls.txt", "w")
		for line in fin:
			items = json.loads(line[:-1], "utf-8")				
			try:
				if len(items['header']) > 0:
					header = startingAdd1+ items['header']
					if header not in self.url2urlDic:
						self.start_urls.append(header)
						self.url2locDic[header] = set()
						self.url2locDic[header].add(items['header'])
						self.url2urlDic[header] = "/wiki/"+items['header']
					else:
						self.url2locDic[header].add(items['header'])
			except:
				continue
			if 'urls' not in items: continue
			for url in items['urls']:
				key = url[0]
				text = url[1]
				adr = startingAdd2+key
				if adr not in self.url2urlDic:
					self.start_urls.append(adr)
					#print >> fout, adr
					self.url2locDic[adr] = set()
					self.url2locDic[adr].add(text)
					self.url2urlDic[adr] = key
				else:
					self.url2locDic[adr].add(text)
				
		fin.close
		#fout.close

	def parse(self, response):
		url = response.url
		startingAdr = "http://en.wikipedia.org"
		ptr = HtmlXPathSelector(response)
		ulDict = {}
		h1 = ptr.select('//h1/span')
		title = h1[0].select('descendant::text()').extract()[0].encode('utf8','ignore')
		latFlag = 0
		location = {}
		person = {}
		location['title'] = title
		person['title'] = title

		fout = open(self.outFilePer,"a")
		spans = ptr.select("//div[@id='mw-normal-catlinks']")
		if len(spans) != 1:
			spans = ptr.select("//div[@id='mw-normal-catlinks']/a[text()='Categories']")
			if len(spans) != 1:
				print "err in:   ", url
				exit(1)
		categories = spans[0].select("descendant::li/a")
		cat_string = ""
		for cat in categories:
			#tmp = cat.select('@href').extract()
			#cat_url = str(tmp[0]) if len(tmp) == 1 else ""
			tmp = cat.select('text()').extract()
			cat_name = str(tmp[0].encode('utf8', 'ignore')) if len(tmp) ==1 else ''
			#cat_string += cat_url+" "+cat_name+"\t"
			cat_name = cat_name.strip()
			if cat_name.endswith("births") or cat_name.endswith("deaths"):# or cat_name.startswith('Kings of'):
				try:
					person['text'] = list(self.url2locDic[url])
					person['url'] = self.url2urlDic[url]
				except:
					person['text'] = 'UNKNOWN_TXT'
					person['url'] = url[len(startingAdr):]
				print >> fout, json.dumps(person)
				break
		fout.close


		fout = open(self.outFileLoc,"a")
		spans = ptr.select('//span')
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
					location['text'] = list(self.url2locDic[url])
					location['url'] = self.url2urlDic[url]
				except:
					location['text'] = 'UNKNOWN_TXT'
					location['url'] = url[len(startingAdr):]
				print >> fout, json.dumps(location)
				fout.close
				return

		fout.close


