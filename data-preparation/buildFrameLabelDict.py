import sys
import os
import time
from xml.etree import ElementTree
import re
roleSetID = 1

def findLables(fileLst):
	global roleSetID
	global frameLabelDict
	frameLabelDict = {}


        inFile = open("def_roles.txt", "r")
        defLabel = {}
        for line in inFile:
                items = line[:-1].split("\t")
                arg = items[0]
                role = items[1]
                defLabel[arg] = role
        inFile.close

        for (fileName, filePath) in fileLst:
		etree = ElementTree.parse(filePath).getroot()
		lemma = fileName.split('.')[0]	
		roleSets = etree.findall('predicate/roleset')

		roleSetID = min([int(roleset.attrib['id'].split('.')[-1]) for roleset in roleSets])

		for roleset in roleSets:
			if roleset.attrib['id'] == lemma+'.0'+str(roleSetID):
				frameLabelDict[lemma] = {}
				for role in roleset.findall('roles/role'):
					if len(role.attrib['n']) > 1:
						key = 'AM-'+role.attrib['n'].upper()
					else:
						key = 'A'+role.attrib['n'].upper()
					if key not in defLabel:
						print "err in file: ",filePath
						continue
					descr = role.attrib['descr']
					matchRe = re.compile("\(.*\)",re.DOTALL) 
					descr = matchRe.sub("",descr)
					vnrole = role.findall('vnrole')
					
					if descr.split(',') > 1:
						descr = descr.lower().split(',')[0]
					elif descr.split(' or ') > 1:
						descr = descr.lower().split(' or ')[0]
					
					
					if len(descr.split()) > 3:
						if len(vnrole) > 0:
							lbl = vnrole[0].attrib['vntheta'].lower()
						else:
							lbl = defLabel[key].lower()
					else:
						lbl = descr
				
					lbl = lbl.strip()	
					if len(vnrole) > 0:
						#value = lbl+'\t'+role.attrib['descr'].lower()+'\t'+vnrole[0].attrib['vntheta'].lower()
						value = lbl
					else:
						#alue = lbl+'\t'+role.attrib['descr'].lower()
						value = lbl


					#frameLabelDict[lemma][key] = '||| '+lbl+' |||\t'+role.attrib['descr'].lower()
					frameLabelDict[lemma][key] = value
					#if len(vnrole) > 0:
					#	if len(role.attrib['descr'].split()) > 3:
					#	elif role.attrib['descr'].startswith('agent, '):# or role.attrib['descr'].endswith(', agent'):
					#		lbl = vnrole[0].attrib['vntheta'].lower()
					#	elif len(role.attrib['descr'].split(',')) > 1:
					#		lbl = role.attrib['descr'].lower().split(',')[0]
					#	else:
					#		lbl = role.attrib['descr'].lower()
					#	#value = '||| '+lbl+'\t'+role.attrib['descr'].lower()+'\t'+vnrole[0].attrib['vntheta'].lower()
					#	value = lbl+'\t'+role.attrib['descr'].lower()+'\t'+vnrole[0].attrib['vntheta'].lower()
					#	frameLabelDict[lemma][key] = value
				break
		if lemma not in frameLabelDict:
			print lemma
	#####print frame labels#####
	fout = open("frame_labels.1.7.txt","w")
	for lemma in frameLabelDict:
		for arg in frameLabelDict[lemma]:
			print >>fout, "1\t%s\t%s\t%s" %(arg, lemma, frameLabelDict[lemma][arg])
	fout.close

def main():

	inDir = sys.argv[1]
	if not inDir.endswith('/'): inDir += '/'
	fileLst = []
	for file in os.listdir(inDir):
		if file.endswith(".xml") and not file.startswith('.'):
		        filePath = inDir + file
			if os.path.isfile(filePath): fileLst.append((file, filePath))

	sys.stderr.write( "Total predicate files found: %d\n" % (len(fileLst)) )
	t_beg = time.time()
	findLables(fileLst)
	sys.stderr.write( "Total time taken         : %g\n" % (time.time() - t_beg) )


if __name__ == '__main__':
	main()

