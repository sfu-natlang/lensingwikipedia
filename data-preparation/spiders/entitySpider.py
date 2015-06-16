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
	outFileOrg=""
	def __init__(self, **kwargs):
		BaseSpider.__init__(self)
		startingAdd = "https://en.wikipedia.org/wiki/"
		self.inFile=kwargs['infile']
		self.outFileURL=kwargs['outfile']
		self.outFileLoc=kwargs['outfileLoc']
		self.outFilePer=kwargs['outfilePer']
		self.outFileOrg=kwargs['outfileOrg']
		self.start_urls = []
		self.url2locDic = {}
		self.url2urlDic = {}
		self.readFile(self.inFile)
		fout = open(self.outFileURL,"w")
		fout.close
		fout = open(self.outFileLoc,"w")
		fout.close
		fout = open(self.outFilePer,"w")
		fout.close
		fout = open(self.outFileOrg,"w")
		fout.close
	
	def readFile(self, fileName):
		fin = open(fileName,"r")
		startingAdd1 = "https://en.wikipedia.org/wiki/"
		startingAdd2 = "https://en.wikipedia.org"
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
				pass
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
		startingAdr = "https://en.wikipedia.org"
		ptr = HtmlXPathSelector(response)
		ulDict = {}
		h1 = ptr.select('//h1')
		title = h1[0].select('descendant::text()').extract()[0].encode('utf8','ignore').strip()
		latFlag = 0
		location = {}
		person = {}
		organization = {}
		location['title'] = title
		person['title'] = title
		organization['title'] = title
		urlLst = {}
		urlLst['title'] = title
		try:
			urlLst['text'] = list(self.url2locDic[url])
			urlLst['url'] = self.url2urlDic[url]
		except:
			urlLst['text'] = 'UNKNOWN_TXT'
			urlLst['url'] = url[len(startingAdr):]
		urlLst['category'] = []

		fout = open(self.outFilePer,"a")
		foutOrg = open(self.outFileOrg,"a")
		foutURL = open(self.outFileURL,"a")
		isOrg = 0
		spans = ptr.select("//div[@id='mw-content-text']")
		if len(spans)>1:
			print "more than one <div id='mw-content-text'> in\t", url
			exit(1)
		elif len(spans) == 1:
			tables = spans[0].select("descendant::table[@class = 'infobox*']")
			if len(tables) > 1:
				print "more than one infobox in\t", url
				exit(1)
			if len(tables) ==1:
				tds = tables[0].select("/tbody/tr/td::text()'")
				for cell in tds:
					if cell.startswith("Founded") or cell.startswith("Key people") or cell.startswith("Company") \
					    or cell.startswith("Headquarters") or cell.startswith("President") or cell.startswith("Membership") \
					    or cell.startswith("Chief Executive") or cell.startswith("Employees") or cell.startswith("Services") \
					    or cell.startswith("Products"):
						isOrg = 1
						try:
							organization['text'] = list(self.url2locDic[url])
							organization['url'] = self.url2urlDic[url]
						except:
							organization['text'] = 'UNKNOWN_TXT'
							organization['url'] = url[len(startingAdr):]
						break

		spans = ptr.select("//div[@id='mw-normal-catlinks']")
		if len(spans) != 1:
			spans = ptr.select("//div[@id='mw-normal-catlinks']/a[text()='Categories']")
			if len(spans) != 1:
				print "err in:   ", url
				exit(1)
		categories = spans[0].select("descendant::li/a")
		cat_string = ""
		isPerson = 0
		for cat in categories:
			#tmp = cat.select('@href').extract()
			#cat_url = str(tmp[0]) if len(tmp) == 1 else ""
			tmp = cat.select('text()').extract()
			cat_name = str(tmp[0].encode('utf8', 'ignore')) if len(tmp) ==1 else ''
			#cat_string += cat_url+" "+cat_name+"\t"
			cat_name = cat_name.strip()
			urlLst['category'].append(cat_name)
			if not isPerson  and (cat_name.endswith("births") or cat_name.endswith("deaths") or cat_name.startswith('Kings of') or cat_name.startswith('Female') or cat_name.startswith('Women')):
				try:
					person['text'] = list(self.url2locDic[url])
					person['url'] = self.url2urlDic[url]
				except:
					person['text'] = 'UNKNOWN_TXT'
					person['url'] = url[len(startingAdr):]
				print >> fout, json.dumps(person)
				isPerson = 1
				#break
			if not isOrg and (cat_name.startswith("Companies") or (cat_name.find("companies") >= 0)): #or cat_name.find("established in") >= 0:
				try:
					organization['text'] = list(self.url2locDic[url])
					organization['url'] = self.url2urlDic[url]
				except:
					organization['text'] = 'UNKNOWN_TXT'
					organization['url'] = url[len(startingAdr):]
				isOrg = 1
				
		fout.close
		print >> foutURL, json.dumps(urlLst)
		foutURL.close
		if isOrg: print >> foutOrg, json.dumps(organization)
		foutOrg.close
		if isPerson: return

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


