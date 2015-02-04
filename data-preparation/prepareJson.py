import sys
import re
import json
import copy
import codecs
from aligntable import  alignTable
import os

frameLabel = {}
eventsLst = []
locDict = {}
countryDict = {}
COMP_SPAN_FLAG = 1

class Sentence:
	""" """
	def __init__(self, docID, sentID, num_predicates, sentence=''):
		self.docId = docID
		self.sentId = sentID
		self.predicates = [{} for i in range(num_predicates)]
		self.wordList = []
		self.sentence = sentence
		self.processed = 0
	
	def processing_word(self, wordInf, wordIndex):
		self.wordList.append(wordInf[0])
		rootPredicate = ''
		for index, label in enumerate(wordInf):
			if label == '*' or label == '-' or index == 0:
				continue
			if index == 1:
				rootPredicate = label
				continue
			if label[0] == '(' and label[-1] == ')':
				role=label[1:-1].split('*')[0]
				if role == 'V':
					if rootPredicate == '' or rootPredicate == '-':
						print "err in processing predicat", wordInf
						continue
						#exit(1)
					self.predicates[index-2][role] = ((wordIndex, wordIndex+1), wordInf[0], rootPredicate)
				else:
					self.predicates[index-2][role] = ((wordIndex, wordIndex+1), wordInf[0], None)
			elif label[0] == '(' and label[-1] == '*':
				role=label[1:-1]
				if role in self.predicates[index-2] and (role == 'A0' or role == 'A1'):
					print "duplicate argument for the same predicate", role
					exit(1)
				self.predicates[index-2][role] = ((wordIndex, wordIndex), "", None)
			elif label[0] == '*' and label[-1] == ')':
				role=label[1:-1]
				if role  not in self.predicates[index-2]:
					print "missing argument for a predicate", wordInf
					exit(1)
				curVal = self.predicates[index-2][role]
				self.predicates[index-2][role] = ((curVal[0][0], wordIndex+1), "", None)
			else:
				raise Exception, 'unvalid format of start and end of labels: '+label
				

	def process_sent(self):
		if self.processed: return
		global frameLabel
		self.sentence = " ".join(self.wordList)
		for predDic in self.predicates:
			if not predDic.has_key('V'):
				print "err, sentence does not have predicate!", self.sentence
				exit(1)
			v = predDic['V'][2]
			origPred = predDic['V'][2]
			for key in predDic.keys():
				if key == 'V': 
					predDic['V'] = (predDic['V'][1], origPred, predDic['V'][0])
					continue
				if v not in frameLabel: v = "defPred"
				if key not in frameLabel[v]:	
					if key in frameLabel["defPred"]:
						role = frameLabel["defPred"][key]
					else:
						continue
				#if key not in frameLabel[v]:	continue
				else:	role = frameLabel[v][key]
				t = predDic[key][0]
				lexical = " ".join(self.wordList[t[0]:t[1]])
				predDic[key] = (lexical, role, t)
		self.processed = 1


def read_sentence(inFile):
	""" It get a pointer to a file and just read the paragraph spliter and pointer is now at begining of the sentence
	"""
	line = inFile.readline()
	if len(line) == 0:
		return -1
	if line.find('PAR_SPLITTER_SYMBOL') > -1:
		line = inFile.readline()
		if line.split("\t")[0] == '.':
			line = inFile.readline()
		else:
			print "err in reading PAR_SPLITTER_SYMBOL!!"
			exit(1)
		return 1
	return 0

def read_word(inFile):
	""" this function read a line of the file which shows a information of a word, it a list of tokens in this line
	"""
	line = inFile.readline()
	words = []
	words = re.sub(r'\s', ' ', line).split()
	return words

def findSubStrTok(Str, subStr, last=0):
	if last == 0 and Str.startswith(subStr+" "):
		b = 0
		e = b+len(subStr)
		return b,e
	
	b = Str.find(" "+subStr+" ", last)
	if b < 0 and last < (len(Str) - len(subStr)) and Str.endswith(" "+ subStr):
		b = Str.find(" "+subStr)
	elif b < 0:
		return (-1,-1)
	if Str[b] != subStr[0]:
		b+=1
	e = b+len(subStr)
	return b,e

def findSubStr(Str, subStr, last=0):
	b = Str.find(subStr,last)
	#if b < 0 and Str.startswith(subStr+" "):
	if b < 0:
		return (-1,-1)
	e = b+len(subStr)
		
	return b,e

def addNERInfo(docId, tokDesc, alignObj):
	global eventsLst, perDict, locDict, orgDict
	Desc = eventsLst[docId]["description"]	
	cur_ner_info = eventsLst[docId]["ner_info"]
	for index, label in enumerate(['person','organization', 'locations']):
		if label in cur_ner_info and len(cur_ner_info[label]) > 0:
			if label not in eventsLst[docId]: 
				eventsLst[docId][label] = {}
			lastInd = 0
			for l in cur_ner_info[label]:
				b,e = findSubStrTok(tokDesc, l, lastInd)
				if b < 0:
					print "err (%s): '%s'  is not in '%s'" %(label, l, tokDesc)
					continue
				lastInd = e
				b += 1
				if COMP_SPAN_FLAG:
					(rb, re) = alignObj.mapSpan(b,e)
				else:
					(rb,re) = (b,e)
				if label == 'locations':
					if l in locDict:
						eventsLst[docId][label][l] = {}
						eventsLst[docId][label][l]["span"] = (rb, re)
						for k in locDict[l]:
							eventsLst[docId][label][l][k] = locDict[l][k]
				elif label == 'person':
					if l in perDict:
						eventsLst[docId][label][l] = {}
						eventsLst[docId][label][l]["span"] = (rb, re)
						eventsLst[docId][label][l]["title"] = perDict[l]
				else:
					if l in orgDict:
						eventsLst[docId][label][l] = {}
						eventsLst[docId][label][l]["span"] = (rb, re)
						eventsLst[docId][label][l]["title"] = orgDict[l]
	
	if ("locations" not in eventsLst[docId]) or len(eventsLst[docId]["locations"]) == 0:
		wl = 1
		wc = 1
	else:
		wc = 1
		wl = 0
		for loc in eventsLst[docId]["locations"]:
			if "country" in eventsLst[docId]["locations"][loc]:
				wc = 0
				break
	return wl, wc

def print_doc(docs, docId, outFile):
	global eventsLst, woLoc, woCountry
	tokDesc = " ".join([s.sentence for s in docs])
	setTokDesc = set(tokDesc.split())
	setDesc = set(eventsLst[docId]["description"].split())
	if len(setDesc) > 12 and len(setDesc & setTokDesc) < len(setDesc)*0.3:
		print "err: description and tokinzed are not matched!!"
		print tokDesc 
		print eventsLst[docId]["description"]
		print len(setDesc & setTokDesc), setDesc & setTokDesc
		exit(1)
	Desc = eventsLst[docId]["description"]	
	if COMP_SPAN_FLAG:
		alignObj = alignTable(Desc, tokDesc)
	else:
		alignObj = None
	wl,wc = addNERInfo(docId, tokDesc, alignObj)
	woLoc+=wl
	woCountry+=wc

	for sentInd, sent in enumerate(docs):
		preSentLen = len(" ".join([s.sentence for s in docs[:sentInd]]))
		splitedSent = sent.sentence.split(" ")
		## extracting current sentence from original text
		b = preSentLen+1
                if preSentLen > 0: b += 1
                e = b+len(sent.sentence)
		if e > len(tokDesc): e = len(tokDesc)
		if COMP_SPAN_FLAG: sentSpan = alignObj.mapSpan(b,e)
		else: sentSpan = (b,e)
		
		for pred in sent.predicates:
			printable = {}
			printable["sentence"] = {"text": Desc[sentSpan[0]:sentSpan[1]], "span": sentSpan}
			for key in pred:
				if key=='V' or key in frameLabel["defPred"]:
				#if key in ["V", "A0", "A1", "AM-MOD", "AM-NEG", "A2", "A3", "A4"]:
					wInd = pred[key][2]
					b = sum([len(w)+1 for w in splitedSent[:wInd[0]]])
					if preSentLen > 0: b += preSentLen + 1
					b += 1
					e = b+len(pred[key][0])-1
					if tokDesc[b-1:e] != pred[key][0]:
						print b
						print e
						print tokDesc[b-1:e]
						print pred[key][0]
						print tokDesc
						exit(1)
					if COMP_SPAN_FLAG:
						(rb, re) = alignObj.mapSpan(b,e)
						text = Desc[rb:re]
					else:
						(rb, re) = (b,e)
						text = pred[key][0]
					if key == 'V':
						printable["event"] = ((rb, re), text)
						printable["eventRoot"] = pred[key][1]
					else:
						printable[key]= ((rb, re), text)
						printable["role"+key]=pred[key][1]
			printable["descriptionTokenized"] = tokDesc
			for key in eventsLst[docId]:
				if key in printable: 
					print "err,   multiple key!\n", key, tokDesc
				#	exit(1)
				if key == 'ner_info': continue
				if key == 'person' or key == "organization": 
					if len(eventsLst[docId][key]) == 0: continue
				printable[key] = copy.deepcopy(eventsLst[docId][key])

			print >> outFile, json.dumps(printable)
			del printable


def read_fullEvents(fileName):
	inFile = codecs.open(fileName, "r", "utf-8")
	ID = 0
	global eventsLst, locDict, perDict, orgDict
	eventsLst = []
	for line in inFile:
		items = json.loads(line[:-1], "utf-8")				
		#description = str(items['description'].encode('utf8', 'ignore'))
		description = items['description']
		dict = {}
		tempPersonDict = {}
		tempOrgDict = {}
		tempLocDict = {}
		for k in items:
			if k == 'year':
				if items[k].endswith("_BC"):	dict['year'] = -1*int(items[k][:-3])
				else:	dict['year']= int(items[k])
			elif k == 'urls':
				urlDic = {}
				lastInd = 0
				for link in items[k]:
					url = link[0]
					text = link[1]
					#text = str(items[k][link].encode('utf8', 'ignore'))
					b,e = findSubStr(description, text, lastInd)
					if b < 0: 		##HACK
						print lastInd
						print len(description)
						print description.find(text, lastInd)
						#print "err (urls): '%s'  is not in '%s'" %(text, description)
						print "err (urls): '%s'  is not in '%s'" %(text.encode('utf-8'), description.encode('utf-8'))
						exit(1)
						continue
					urlDic[text] = {}
					urlDic[text]["url"] = url
					if url in globalURLDict:
						urlDic[text]['category'] = globalURLDict[url]['category']
						if text.encode('utf-8') not in globalURLDict[url]['text']:
							print "Warning!!!  matched urls and unmatched texts!\n%s  -- %s"%(items['year'],line)
							print text.encode('utf-8'), globalURLDict[url]['text']
					else:
						print "err (urls): '%s'\n from '%s' \nis not in url.json" %(text.encode('utf-8'), description.encode('utf-8'))
						#exit(1)
						
					if url in locDict:
						tempLocDict[text]={}
						for keyInLoc in locDict[url]:
							urlDic[text][keyInLoc] = locDict[url][keyInLoc]
							tempLocDict[text][keyInLoc] = locDict[url][keyInLoc]
						tempLocDict[text]["span"] = (b,e)
					urlDic[text]["span"] = (b,e)
					lastInd=e
					if url in perDict:
						tempPersonDict[text] = {"span":(b,e), "title":perDict[url]}
					if url in orgDict:
						tempOrgDict[text] = {"span":(b,e), "title":orgDict[url]}
				dict["wiki_info"]=urlDic
			else:
				#key = str(k.encode('utf8', 'ignore'))
				#dict[key] = str(items[k].encode('utf8', 'ignore'))
				dict[k] = items[k]
		if len(tempPersonDict) > 0: dict['person']=tempPersonDict
		if len(tempOrgDict) > 0: dict['organization']=tempOrgDict
		if len(tempLocDict) > 0: dict['locations']=tempLocDict
		eventsLst.append(dict)
	inFile.close

def parse_SRL():
	global eventsLst, locDict, noEvents, woLoc, woCountry, finalJsonFile
	inFile = codecs.open(sys.argv[1], "r", "utf-8")
	outFile = codecs.open(finalJsonFile, "w", "utf-8")
        docId=0
	sentId=0
	flag = 1 
	flagSpliter = 0
	document = []
	noEvents = 0
	sent = None
	woLoc = 0
	woCountry = 0
	for line in inFile:
		items = line[:-1].split("\t")
		if "V*V" in line:
			noEvents +=1	
		if len(items) == 2:
			if items[0] == "PAR_SPLITTER_SYMBOL":
				print_doc(document, docId, outFile)
				docId += 1
				flagSpliter = 1
				sent = None
				continue
			elif flagSpliter==1 and items[0] == '.': 
				flagSpliter = 0
				flag = 1
				document = []
				continue
			elif flagSpliter == 1 and items[0] != '.':
				print "UKNWN input", line
				exit(1)
		if len(items) >= 2:
			numPredicates = len(items)-2
			if flag :
				sent = Sentence(docId, sentId, numPredicates)
				wordIndex = 0
				flag = 0
			sent.processing_word(items, wordIndex)	
			wordIndex += 1
		elif flag: continue
		else:
			sent.process_sent()	
			document.append(sent)
			flag = 1
	if sent:
		sent.process_sent()	
		document.append(sent)
		print_doc(document, docId, outFile)
        	docId += 1

	outFile.close()
	inFile.close()
	print "events without location:", woLoc
	print "events without country:", woCountry
	print "No of documents: ", docId
	print "No of events: ", noEvents

def read_frames(fileName):
	inFile = open(fileName, "r")
	global frameLabel, script_dir
	for line in inFile:
		items = line[:-1].split("\t")
		pred = items[2]
		arg = items[1]
		role = items[3]
		if pred not in frameLabel:
			frameLabel[pred] = {}
		frameLabel[pred][arg] = role
	inFile.close
	inFile = open(script_dir+"data/def_roles.txt", "r")
	frameLabel["defPred"] = {}
	for line in inFile:
		items = line[:-1].split("\t")
		arg = items[0]
		role = items[1]
		frameLabel["defPred"][arg] = role.lower()
	inFile.close
	
def read_location(fileName):
	inFile = codecs.open(fileName, "r", encoding='utf-8')
	global locDict
	locDict = {}
	for line in inFile:
		items = json.loads(line[:-1], "utf-8")	
		if 'url' in items:
			key = items['url']
		elif 'text' in items:
			key = items['text']
		else:
			sys.stderr.write("           INFO  :: Invalid location entry:\n %s\n Aborting!!\n" % (line))
			return 1
		locDict[key] = {}
		for k in items:
			if k != 'url' and k != 'text':
				locDict[key][k] = items[k]
		
	inFile.close

def read_person(fileName):
	inFile = codecs.open(fileName, "r", encoding='utf-8')
	global perDict
	perDict = {}
	for line in inFile:
		items = json.loads(line[:-1], 'utf-8')
		if 'url' in items:
			key = items['url']
		elif 'text' in items:
			key = items['text']
		else:
			sys.stderr.write("           INFO  :: Invalid person entry:\n %s\n Aborting!!\n" % (line))
			return 1
		perDict[key] = items['title']
	inFile.close
	
def read_organization(fileName):
	inFile = codecs.open(fileName, "r", encoding='utf-8')
	global orgDict
	orgDict = {}
	for line in inFile:
		items = json.loads(line[:-1], 'utf-8')
		if 'url' in items:
			key = items['url']
		elif 'text' in items:
			key = items['text']
		else:
			sys.stderr.write("           INFO  :: Invalid person entry:\n %s\n Aborting!!\n" % (line))
			return 1
		orgDict[key] = items['title']
	inFile.close
	
def readNER(fileName):
        inpFile = open(fileName, "r")
	global nerLst
	nerLst = []
        personLst = []
	orgLst = []
	locationLst = []
	wLst = []
	preTag = ''
        for line in inpFile:
                if "PAR_SPLITTER_SYMBOL" in line: #or "PAR_SPLITTER_SYMBOL" in line:
			nerLst.append((personLst,orgLst,locationLst))
                	personLst = []
			orgLst = []
			locationLst = []
                        continue
                line = re.sub(r'\\/', '/', line)
                words = re.sub(r'\s', ' ', line).split()
                for w in words:
                        w_parts = w.split('/')
                        if preTag != w_parts[-1] and preTag == 'PERSON':
                                personLst.append(" ".join(wLst))
			#	print personLst[-1], preTag 
				preTag = w_parts[-1]
				wLst = []
                        elif preTag != w_parts[-1] and preTag == 'ORGANIZATION':
                                orgLst.append(" ".join(wLst))
			#	print orgLst[-1], preTag 
				preTag = w_parts[-1]
				wLst = []
                        elif preTag != w_parts[-1] and preTag == 'LOCATION':
                                locationLst.append(" ".join(wLst))
			#	print locationLst[-1] , preTag 
				preTag = w_parts[-1]
				wLst = []
			#elif preTag == w_parts[-1]:
                        #        wLst.append(w_parts[0])
			elif preTag != w_parts[-1]: 
				preTag = w_parts[-1]
				wLst = []
                        wLst.append("/".join(w_parts[:-1]))


	#if len(locationLst) > 0 or len(personLst) > 0 or len(orgLst) > 0:
	nerLst.append((personLst,orgLst,locationLst))
	print len(nerLst)
        inpFile.close

def read_url(fileName):
	inFile = codecs.open(fileName, "r", encoding='utf-8')
	global globalURLDict
	globalURLDict = {}
	for line in inFile:
		items = json.loads(line[:-1], 'utf-8')
		if 'url' in items:
			key = items['url']
		else:
			sys.stderr.write("           INFO  :: Invalid url entry:\n %s\n Aborting!!\n" % (line))
			exit(1)
		globalURLDict[key] = {'text': items["text"], 'category': items["category"]}
	print "read %d url entries from %s" %(len(globalURLDict), fileName)
	inFile.close()
			

if __name__ == '__main__':
	if len(sys.argv) < 8 or len(sys.argv) > 9:
		print "usage:  python  %s <srl-data-file> <location-json-file> <organization-json-file> <person-json-file> <urlInfo-json-file> <crawled-json-file> <json-output-name> [flag for computing spans]" %(sys.argv[0])
		print "'frame_labels.txt' and 'def_roles.txt' are supposed to be in local directory 'data/'."
		exit(1)
	if len(sys.argv) == 9:
		COMP_SPAN_FLAG = int(sys.argv[8])
	full_path = os.path.realpath(__file__)
	global script_dir, finalJsonFile, perDict, orgDict
	script_dir = "/".join(full_path.split("/")[:-1]) + "/"
	read_frames(script_dir+"data/frame_labels.txt")
	read_location(sys.argv[2])
	read_organization(sys.argv[3])
	read_person(sys.argv[4])
	read_url(sys.argv[5])
	read_fullEvents(sys.argv[6])
	finalJsonFile = sys.argv[7]
	parse_SRL()
