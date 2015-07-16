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
		startingAdd = "https://en.wikipedia.org/wiki/"
		self.inFile=kwargs['infile']
		self.outFile=kwargs['outfile']
		self.start_urls = []
		self.url2locDic = {}
		#self.url2locDic = {"https://en.wikipedia.org/wiki/Air_trans":"Air trans"}
		#self.start_urls = ["https://en.wikipedia.org/wiki/Air_trans"]
		self.readFile(self.inFile)
		fout = codecs.open(self.outFile,"w", encoding='utf-8')
		fout.close
	
	def readFile(self, fileName):
		fout = open(fileName,"r")
		startingAdd1 = "https://en.wikipedia.org/wiki/"
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
		org = {}
		is_org = 0
		org['title'] = title
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
						is_org = 1				
						try:
							text = self.url2locDic[url]
							org['text'] = text
							org['url'] = "/wiki/"+"_".join(text.split())
						except:
							startingAdd1 = "https://en.wikipedia.org/wiki/"
							org['url'] = "/wiki/"+url[len(startingAdd1):]
							org['text'] = " ".join(url[len(startingAdd1)+6:].split("_"))
						break
			
		spans = ptr.select("//div[@id='mw-normal-catlinks']")
		if len(spans) != 1:
			spans = ptr.select("//div[@id='mw-normal-catlinks']/a[text()='Categories']")
			if len(spans) != 1:
				print "err in:   ", url
				exit(1)
		categories = spans[0].select("descendant::li/a")
		cat_string = ""
		org['category'] = []
		for cat in categories:
			#tmp = cat.select('@href').extract()
			#cat_url = str(tmp[0]) if len(tmp) == 1 else ""
			tmp = cat.select('text()').extract()
			cat_name = str(tmp[0].encode('utf8', 'ignore')) if len(tmp) ==1 else ''
			#cat_string += cat_url+" "+cat_name+"\t"
			cat_name = cat_name.strip()
			org['category'].append(cat_name)
			if not is_org and (cat_name.startswith("Companies") or cat_name.find("companies") >= 0): #or cat_name.find("established in") >= 0:
			#if not is_org and (cat_name.startswith("Companies") or (cat_name.find("established in") >= 0  or (cat_name.find("companies") >= 0))):
				is_org = 1
				try:
					text = self.url2locDic[url]
					org['text'] = text
					org['url'] = "/wiki/"+"_".join(text.split())
				except:
					startingAdd1 = "https://en.wikipedia.org/wiki/"
					org['url'] = "/wiki/"+url[len(startingAdd1):]
					org['text'] = " ".join(url[len(startingAdd1)+6:].split("_"))
		if is_org: print >> fout, json.dumps(org)

		fout.close

