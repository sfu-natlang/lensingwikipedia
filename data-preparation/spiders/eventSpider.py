from scrapy.spider import BaseSpider
from scrapy.selector import HtmlXPathSelector
from scrapy.contrib.spiders import CrawlSpider, Rule
from scrapy.contrib.linkextractors.sgml import SgmlLinkExtractor
import sys
import os
import re
import json

#from django.utils.encoding import smart_str

def ensure_dir(f):
    d = os.path.dirname(f)
    if not os.path.exists(d):
        os.makedirs(d)
    fout = open(f,"w")
    fout.close
    

class eventSpider(BaseSpider):
	name = "eventSpiderSpider"
	allowed_domains = ["en.wikipedia.org"]
	outDir=''
	outFile=''
	endYear=0
	def __init__(self, **kwargs):
		BaseSpider.__init__(self)
		try:
			self.outDir=kwargs['outDir']
			if self.outDir[-1]!= '/': self.outDir += '/'
			self.endYear=int(kwargs['endYear'])
		except:
			print >>sys.stderr, "eventSpider needs 3 arguments: outDir, outFile, endYear"
			exit(1)
		startingAdd = "http://en.wikipedia.org/wiki/"
		self.start_urls = []
#		self.start_urls = [startingAdd+"2011"]
#  		if not os.path.exists(self.outDir+"2011"):   os.makedirs(self.outDir+"2011")
		for i in range(1500, 499, -10):
			add = startingAdd+str(i)+"_BC"
			self.start_urls.append(add)
			path = self.outDir+str(i)+"_BC/"
    			if not os.path.exists(path):   os.makedirs(path)
		for i in range(499, 0, -1):
			add = startingAdd+str(i)+"_BC"
			self.start_urls.append(add)
			path = self.outDir+str(i)+"_BC/"
    			if not os.path.exists(path):   os.makedirs(path)
		for i in range(1, self.endYear+1):
			add = startingAdd+str(i)
			self.start_urls.append(add)
			path = self.outDir+str(i)+"/"
   			if not os.path.exists(path):   os.makedirs(path)
		

	def parse(self,response):
		printable = {}
		year = response.url.split("/")[-1]
		printable['year'] = year
		fPath = open(self.outDir+year+"/path.txt","w")
		numFile = 0
		ptr = HtmlXPathSelector(response)
		ulDict = {}
		roots = ptr.select('//h2')
		i = 0
		for root in roots:
			if len(root.select('span')) > 0:
				break
			i +=1
		topics = root.select('../h3|../h4|../h2|../ul')
		flag = 0
		topic_name = ''
		for topic in topics:
			node_name = str(topic.select('name()').extract()[0])
			if node_name == 'h2':
				content = topic.select('span/text()').extract()
				#content = content[-1] if len(content) > 0 else ''
				for tt in content:
					topic_name = str(tt)
					if topic_name == 'Events' or topic_name == 'Events and trends': break
				if (topic_name != 'Events' and topic_name != 'Events and trends' ) and flag == 0: continue
				if flag:
					#print "break!   ",node_name
					break
				flag = 1
				#print "continue!   ",node_name, topic_name
				topic_name = ''
				continue
			if flag == 0: continue
			if node_name == 'h3'or node_name == 'h4':
				content = topic.select('span/text()').extract()
				for tt in content:	
					topic_name = str(tt.encode('utf8', 'ignore'))
					if len(topic_name) > 2: break
				#print "continue!   ",node_name, topic_name
				continue	
			#print "out!!!   ",node_name, topic_name
			printable['header'] = topic_name
			#lis = topic.select('following-sibling::ul[1]').select('li')
			lis = topic.select('li')
			for ind, li in enumerate(lis):
				#print li
				if len(li.select('ul/li')) > 0:
					for tmp in li.select('ul/li'):
						lis.insert(ind+1,tmp)
					continue
				
				htmlText = li.extract().encode('utf8', 'ignore')
				#htmlText = " ".join([item.encode('utf8', 'ignore') for item in li.select('*').extract()])
				matchRe = re.compile("<div class=.*>.*</div>",re.DOTALL) 
				clnhtmlText = matchRe.sub("",htmlText)
				#hxs = HtmlXPathSelector(clnhtmlText)
				hxs = HtmlXPathSelector(text= clnhtmlText)
				#desc = li.select('descendant::text()').extract()
				desc = hxs.select('descendant::text()').extract()
				text = ''
				for tt in desc:
					content = tt.encode('utf8', 'ignore')
					if str(content) != "\n":
						text += str(content).rstrip("\n")
				text = text.rstrip('\n')
				text = re.sub(r'\[[0-9]+\]', r' ', text)
				printable['description'] = text
				
				linked_entity = []
				links = li.select('./a')
				#links = hxs.select('./a')
				for link in links:
					try:
						t = link.select('text()').extract()[0].encode('utf8','ignore')
						if t not in text:
							l ="" 
						else:
							#l = link.select('@href').extract()[0].encode('utf8','ignore') + ' '+t
							key = link.select('@href').extract()[0].encode('utf8','ignore')
							linked_entity.append((key, t))
					except:
						l = ''
				printable['urls'] = linked_entity
				clnhtmlText = clnhtmlText.strip()
				if clnhtmlText.startswith("<li>"):
					clnhtmlText=clnhtmlText[4:]
				if clnhtmlText.endswith("</li>"):
					clnhtmlText=clnhtmlText[:-5]
				clnhtmlText = re.sub(r'<sup id=".*" class="reference">.*</sup>', r' ', clnhtmlText)
				clnhtmlText = clnhtmlText.strip()
				printable['html_fragment'] = clnhtmlText
				fout = open(self.outDir+year+"/"+str(numFile)+".txt","w")
				fJson = open(self.outDir+year+"/"+str(numFile)+".json","w")
				print >> fJson, json.dumps(printable)
				print >> fout, printable['description']
				print >> fPath, self.outDir+year+"/"+str(numFile)+".txt"
				#fout.write("%s\t%s\t%s\t%s\t%s\n" %(year,topic_name,text, clnhtmlText, "\t".join(linked_entity))
				fout.close
				fJson.close
				numFile += 1

		fPath.close	


