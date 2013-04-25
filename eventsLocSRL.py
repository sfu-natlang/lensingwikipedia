import sys
import re
import json
import copy
import codecs
import stredit

frameLabel = {}
eventsLst = []
locDict = {}
countryDict = {}

class Sentence:
	""" """
	def __init__(self, docID, sentID, num_predicates, sentence=''):
		self.docId = docID
		self.sentId = sentID
		self.predicates = [{} for i in range(num_predicates)]
		self.wordList = []
		self.sentence = sentence
	
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
		global frameLabel
		self.sentence = " ".join(self.wordList)
		for predDic in self.predicates:
			if not predDic.has_key('V'):
				print "err, sentence does not have predicate!", self.sentence
				exit(1)
			v = predDic['V'][2]
			for key in predDic.keys():
				if key == 'V': continue
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
			predDic['V'] = (predDic['V'][1], v, predDic['V'][0])


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

def print_doc(docs, docId, outFile):
	global eventsLst
	tokDesc = " ".join([s.sentence for s in docs])
	setTokDesc = set(tokDesc.split())
	setDesc = set(eventsLst[docId]["description"].split())
	if len(setDesc) > 12 and len(setDesc & setTokDesc) < len(setDesc)*0.3:
		print "err: description oand tokinzed are not matched!!"
		print tokDesc 
		print eventsLst[docId]["description"]
		print len(setDesc & setTokDesc), setDesc & setTokDesc
		exit(1)
	Desc = eventsLst[docId]["description"]	
	for sentInd, sent in enumerate(docs):
		preSentLen = len(" ".join([s.sentence for s in docs[:sentInd]]))
		#print "pre sent lens: ", preSentLen
		splitedSent = sent.sentence.split()
		for pred in sent.predicates:
			printable = {}
			for key in pred:
				if key in ["V", "A0", "A1", "AM-MOD", "AM-NEG"]:
					#b = tokDesc.find(pred[key][0])
					#if b < 0: 
					#	print pred[key][0]
					#	print tokDesc 
					#	print Desc
					#	exit(1)
					wInd = pred[key][2]
					b = sum([len(w)+1 for w in splitedSent[:wInd[0]]])
					#b += 1 # start from index 1 instead of 0
					if preSentLen > 0: b += preSentLen + 1
					b += 1
					e = b+len(pred[key][0])-1
					#if e => len(tokDesc):
					#	e = len(tokDesc) -1
					#print b, e
					#print tokDesc[b-1:e-1],"|"
					if tokDesc[b-1:e] != pred[key][0]:
						print b
						print e
						print tokDesc[b-1:e]
						print pred[key][0]
						print tokDesc
						exit(1)
					(rb, re) = stredit.streditmap(Desc,tokDesc,b,e)
					text = Desc[rb:re]
					#print text,"|", tokDesc[b-1:e],"|"
					if key == "V":
						printable["event"] = ((rb, re), text)
						printable["eventRoot"] = pred[key][1]
					else:
						printable[key]= ((rb, re), text)
						printable["role"+key]=pred[key][1]
			printable["descriptionTokenized"] = tokDesc
			for key in eventsLst[docId]:
				#if key in printable: 
				#	print "err,   multiple key!"
				#	exit(1)
				printable[key] = copy.deepcopy(eventsLst[docId][key])
			print >> outFile, json.dumps(printable)
			del printable

def convertCord(cord):
	sign = -1 if cord[-1] == 'S' or cord[-1] == 'W' else 1
	digits = ''
	for c in cord:
		if str.isdigit(c) or c == '.': digits += c
		else: digits +=' '
	s = '0'
	m = '0'
	if len(digits.split())>2:
		d,m,s = digits.split()
	elif len(digits.split())==2:
		d,m = digits.split()
	else:
		d=digits.strip()
	d = float(d)
	m = float(m)
	s = float(s)
	return sign*(d+m/60+s/3600)

def read_fullEvents(fileName):
	inFile = codecs.open(fileName, "r", "utf-8")
	ID = 0
	global eventsLst, locDict, countryDict
	eventsLst = []
	woLoc = 0
	woCountry = 0
	for line in inFile:
		items = line[:-1].split("\t")
		dict = {}
		if items[0].endswith("_BC"):
			dict["year"] = -1*int(items[0][:-3])
		else:
			dict["year"] = int(items[0])
		dict["header"] = items[1]
		dict["description"] = items[2]
		urlDic = {}
		dict["locations"] = []
		if len(items) > 3:
			for link in items[3:]:
				if len(link) == 0: continue
				url = link.split()[0]
				text = " ".join(link.split()[1:])
				urlDic[text] = url
				if url in locDict:
					loc = {}
					loc["latitude"] = locDict[url][0]
					loc["longtitude"] = locDict[url][1]
					loc["text"] = text
					if url in countryDict:
						loc["country"] = countryDict[url]
					dict["locations"].append(loc)
		dict["urls"]=urlDic
		for key in locDict:
			if key in items[2]:
				loc = {}
				loc["latitude"] = locDict[key][0]
				loc["longtitude"] = locDict[key][1]
				loc["text"] = key
				b = items[2].find(key)
				e = b + len(key)
				loc["span"] = (b, e)
				if key in countryDict:
					loc["country"] = countryDict[key]
				dict["locations"].append(loc)
				
			
		#if not("country" in dict):
		#	for key in countryDict:
		#		if key in items[2]:
		#			dict["country"] = countryDict[key]
		#			break
		
		if len(dict["locations"]) == 0:
			woLoc += 1
			woCountry += 1
		else:
			woCountry += 1
			for loc in dict["locations"]:
				if "country" in loc:
					woCountry -= 1
					break
		eventsLst.append(dict)
	inFile.close
	print "events without location:", woLoc
	print "events without country:", woCountry

def parse_SRL():
	#inFile = open("SRLOutput.txt", "r")
	inFile = open(sys.argv[1], "r")
	#outFile = open("featuresLvl1.txt", "w")
	outFile = codecs.open(sys.argv[4], "w", "utf-8")
	#outFile = open("events.jason", "w")
	global eventsLst, locDict, noEvents
        docId=0
	sentId=0
	flag = 1 
	flagSpliter = 0
	document = []
	noEvents = 0
	sent = None
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
	print "No of documents: ", docId
	print "No of events: ", noEvents

def read_frames(fileName):
	inFile = open(fileName, "r")
	global frameLabel
	for line in inFile:
		items = line[:-1].split("\t")
		pred = items[2]
		arg = items[1]
		role = items[3]
		if pred not in frameLabel:
			frameLabel[pred] = {}
		frameLabel[pred][arg] = role
	inFile.close
	inFile = open("def_roles.txt", "r")
	frameLabel["defPred"] = {}
	for line in inFile:
		items = line[:-1].split("\t")
		arg = items[0]
		role = items[1]
		frameLabel["defPred"][arg] = role
	inFile.close
	
def read_location(fileName):
	inFile = open(fileName, "r")
	global locDict, countryDict
	locDict = {}
	countryDict = {}
	for line in inFile:
		items = line[:-1].split("\t")
		key = items[0]
		latitude,longitude = items[1].split(" , ")
		locDict[key] = (float(latitude), float(longitude))
		if len(items) > 2:
			countryDict[key] = items[2]
	inFile.close
		

if __name__ == '__main__':
	read_frames("frame_labels.txt")
	read_location(sys.argv[2])
	read_fullEvents(sys.argv[3])
	parse_SRL()
