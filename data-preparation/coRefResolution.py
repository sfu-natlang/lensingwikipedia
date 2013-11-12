import sys
import os
import time
from xml.etree import ElementTree
import re
import json
import codecs

roleSetID = 1
personDict = {}
locationDict = {}
organDict = {}

def findLables((fileName,filePath), outJson, outTokenized):
	global locationDict, personDict, organDict
	etree = ElementTree.parse(filePath).getroot()
	sentSet = etree.findall('document/sentences/sentence')
	sentences = []
	totalDescription = []
	personLst = []
	locationLst = []
	organLst = []
	outFile = codecs.open(outTokenized, "a", "utf-8")
	for sent in sentSet:
		prev_ner = 'O'
		nerText = ''
		sentWords = []
		for id, token in enumerate(sent.findall('tokens/token')):
			if id+1 != int(token.attrib['id']):
				print "not sequential tokens!!", id
				return 0
			tok_ner = token.find('NER').text
			word = token.find('word').text
			sentWords.append(word)
			if tok_ner != prev_ner:
				if prev_ner == "PERSON":
					personDict[nerText] = 1
					personLst.append(nerText)
				elif prev_ner == "LOCATION":
					locationDict[nerText] = 1
					locationLst.append(nerText)
				elif prev_ner == "ORGANIZATION":
					organDict[nerText] = 1
					organLst.append(nerText)
				nerText = word
			elif prev_ner in ["PERSON", "LOCATION", "ORGANIZATION"]:	nerText += " "+word
			else: nerText = ''
			prev_ner = tok_ner
		if sentWords[-1] != '.': 
			print >> outFile, " ".join(sentWords+["."])
		else:
			print >> outFile, " ".join(sentWords)
		sentences.append(sentWords)
	print >> outFile, "PAR_SPLITTER_SYMBOL ."
	outFile.close
	jsonName = ".".join(filePath.split(".")[:-1])+".json"
	inFile = codecs.open(jsonName, "r", "utf-8")
	fline = inFile.readline()
	inFile.close
	jStat = json.loads(fline[:-1], "utf-8")
	### adding ner info to json entry
	jStat["ner_info"] = {"person": personLst, "locations": locationLst, "organization": organLst}
	
	### adding coref info to json entry
	corefSet = etree.findall('document/coreference/coreference')
	if len(corefSet) > 0:
		jStat["coref"] = {}
	for coref in corefSet:
		newEntry = {}
		for id, mention in enumerate(coref.findall('mention')):
			sent = int(mention.find('sentence').text) -1
			start = int(mention.find('start').text) -1
			end = int(mention.find('end').text) -1
			head = int(mention.find('head').text) -1
			newEntry[str(id)] = {}
			newEntry[str(id)]["head"] = sentences[sent][head]
			#print start, end, sent
			newEntry[str(id)]["phrase"] = " ".join(sentences[sent][start:end])
			if len(mention.attrib) and mention.attrib['representative']:
				newEntry['representative'] = str(id)
				key = sentences[sent][head]
		jStat["coref"][key] = newEntry
				
	outFile = codecs.open(outJson, "a", "utf-8")
	print >> outFile, json.dumps(jStat)
	outFile.close
	return 1

def main():
	global locationDict, personDict, organDict
	if len(sys.argv) != 4:
		sys.stderr.write( "Usage: %s <input_dir> <prefix_for_outputFiles> <out_jsonFile>\n" % (sys.argv[0]) )
		exit(1)
		
	inDir = sys.argv[1]
	locFile = sys.argv[2]+".loc"
	perFile = sys.argv[2]+".per"
	orgFile = sys.argv[2]+".org"
	tokenizedFile = sys.argv[2]+".tok"
	if not inDir.endswith('/'): inDir += '/'
	fileLst = []
	for file in os.listdir(inDir):
		if file.endswith(".xml") and not file.startswith('.'):
		        filePath = inDir + file
			if os.path.isfile(filePath): fileLst.append((file, filePath))
			if findLables((file, filePath), sys.argv[3], tokenizedFile)==0:
				sys.stderr.write( "Error in processing dir: %s\n" % (inDir) )
				exit(1)

	sys.stderr.write( "Total predicate files found: %d\n" % (len(fileLst)) )
	t_beg = time.time()
	sys.stderr.write( "Total time taken         : %g\n" % (time.time() - t_beg) )
	#####print recognized NER in file#####
	foutLoc = codecs.open(locFile,"a", "utf-8")
	foutPer = codecs.open(perFile,"a", "utf-8")
	foutOrg = codecs.open(orgFile,"a", "utf-8")
	for loc in locationDict:
		print >> foutLoc, loc.strip()
	for per in personDict:
		print >> foutPer, per.strip()
	for org in organDict:
		print >> foutOrg, org.strip()
	foutLoc.close
	foutPer.close
	foutOrg.close


if __name__ == '__main__':
	main()

