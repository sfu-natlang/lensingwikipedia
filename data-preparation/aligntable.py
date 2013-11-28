
import sys




def argmin (*a):
    """Return two arguments: first the smallest value, second its offset"""
    min = sys.maxint; arg = -1; i = 0
    for x in a:
        if (x < min):
            min = x; arg = i
        i += 1
    return (min,arg)
            

def stredit (s1,s2, showtable=True):
    "Calculate Levenstein edit distance for strings s1 and s2."
    len1 = len(s1) # vertically
    len2 = len(s2) # horizontally
    # Allocate the table
    table = [None]*(len2+1)
    for i in range(len2+1): table[i] = [0]*(len1+1)
    # Initialize the table
    for i in range(1, len2+1): table[i][0] = i
    for i in range(1, len1+1): table[0][i] = i
    # Do dynamic programming
    for i in range(1,len2+1):
        for j in range(1,len1+1):
            if s1[j-1] == s2[i-1]:
                d = 0
            else:
                d = 1
            table[i][j] = min(table[i-1][j-1] + d,
                              table[i-1][j]+1,
                              table[i][j-1]+1)
    if showtable:
        print_table(s1, s2, table)
    return table[len2][len1]


		


# map span i,j from s1 into s2
def streditmap (s1, s2, beg, end):
    "map a string from one string s1 to another string s2 assumed to be a tokenized version of s1"
    len1 = len(s1) # vertically
    len2 = len(s2) # horizontally
    # Allocate tables
    table = [None]*(len2+1)
    for i in range(len2+1): table[i] = [0]*(len1+1)
    trace = [None]*(len2+1)
    for i in range(len2+1): trace[i] = [None]*(len1+1)
    # initialize table
    for i in range(1, len2+1): table[i][0] = i
    for i in range(1, len1+1): table[0][i] = i
    # in the trace table, 0=subst, 1=insert, 2=delete
    for i in range(1,len2+1): trace[i][0] = 1
    for j in range(1,len1+1): trace[0][j] = 2
    # Do dynamic programming
    for i in range(1,len2+1):
        for j in range(1,len1+1):
            if s1[j-1] == s2[i-1]:
                d = 0
            else:
                d = 1
            # if true, the integer value of the first clause in the "or" is 1
            table[i][j],trace[i][j] = argmin(table[i-1][j-1] + d,
                                             table[i-1][j]+1,
                                             table[i][j-1]+1)
    # If you are implementing Smith-Waterman, then instead of initializing
    # i=len2 and j=len1, you must initialize i and j to the indices 
    # of the table entry that has the miminum value (it will be negative)
    i = len2
    j = len1
    while i != 0 or j != 0:
        if trace[i][j] == 0:
            nexti = i-1
            nextj = j-1
        elif trace[i][j] == 1:
            nexti = i-1
            nextj = j
        elif trace[i][j] == 2:
            nexti = i
            nextj = j-1
        else:
            nexti = 0
            nextj = 0
        trace[i][j] = "*"
        i = nexti
        j = nextj
    #print_table(s1, s2, table, trace)
    #print trace[beg], table[end]
    rb, re = trace[beg].index("*"), trace[end].index("*")
    return (rb-1, re)





class alignTable(object):
	''' alignTable is a class for alignment table of two given string. '''
	def __init__(self, s1, s2):
		self.table = None
		self.trace = None
		self.makeAlignMap(s1,s2)

	def print_table(self,s1,s2):
	    """print the DP table, t, for strings s1 and s2.  
	    If the optional 'trace' is present, print * indicators for the alignment.
	    Fancy formatting ensures this will also work when s1 and s2 are lists of strings"""
	    print "       ",
	    for i in range(len(s1)):
        	print "%3.3s" % s1[i],
	    print
	    for i in range(len(self.table)):
        	if i > 0: print "%3.3s" % s2[i-1], 
	        else: print '   ',
	        for j in range(len(self.table[i])):
	            if self.trace and self.trace[i][j] == "*":
	                print "*" + "%2d" % self.table[i][j],
	            else:
	                print "%3d" % self.table[i][j],
	        print
	def makeAlignMap (self, s1, s2):
	    "map a string from one string s1 to another string s2 assumed to be a tokenized version of s1"
	    len1 = len(s1) # vertically
	    len2 = len(s2) # horizontally
	    # Allocate tables
	    self.table = [None]*(len2+1)
	    for i in range(len2+1): self.table[i] = [0]*(len1+1)
	    self.trace = [None]*(len2+1)
	    for i in range(len2+1): self.trace[i] = [None]*(len1+1)
	    # initialize table
	    for i in range(1, len2+1): self.table[i][0] = i
	    for i in range(1, len1+1): self.table[0][i] = i
	    # in the trace table, 0=subst, 1=insert, 2=delete
	    for i in range(1,len2+1): self.trace[i][0] = 1
	    for j in range(1,len1+1): self.trace[0][j] = 2
	    # Do dynamic programming
	    for i in range(1,len2+1):
	        for j in range(1,len1+1):
	            if s1[j-1] == s2[i-1]:
	                d = 0
	            else:
	                d = 1
	            # if true, the integer value of the first clause in the "or" is 1
	            self.table[i][j],self.trace[i][j] = argmin(self.table[i-1][j-1] + d,
	                                             self.table[i-1][j]+1,
	                                             self.table[i][j-1]+1)
	    # If you are implementing Smith-Waterman, then instead of initializing
	    # i=len2 and j=len1, you must initialize i and j to the indices 
	    # of the table entry that has the miminum value (it will be negative)
	    i = len2
	    j = len1
	    while i != 0 or j != 0:
	        if self.trace[i][j] == 0:
	            nexti = i-1
	            nextj = j-1
	        elif self.trace[i][j] == 1:
	            nexti = i-1
	            nextj = j
	        elif self.trace[i][j] == 2:
	            nexti = i
	            nextj = j-1
	        else:
	            nexti = 0
	            nextj = 0
	        self.trace[i][j] = "*"
	        i = nexti
	        j = nextj



	def mapSpan(self, beg, end):
    		rb, re = self.trace[beg].index("*"), self.trace[end].index("*")
		return (rb-1, re)

		
def stredit2 (s1,s2, showtable=True):
    "String edit distance, keeping trace of best alignment"
    len1 = len(s1) # vertically
    len2 = len(s2) # horizontally
    # Allocate tables
    table = [None]*(len2+1)
    for i in range(len2+1): table[i] = [0]*(len1+1)
    trace = [None]*(len2+1)
    for i in range(len2+1): trace[i] = [None]*(len1+1)
    # initialize table
    for i in range(1, len2+1): table[i][0] = i
    for i in range(1, len1+1): table[0][i] = i
    # in the trace table, 0=subst, 1=insert, 2=delete
    for i in range(1,len2+1): trace[i][0] = 1
    for j in range(1,len1+1): trace[0][j] = 2
    # Do dynamic programming
    for i in range(1,len2+1):
        for j in range(1,len1+1):
            if s1[j-1] == s2[i-1]:
                d = 0
            else:
                d = 1
            # if true, the integer value of the first clause in the "or" is 1
            table[i][j],trace[i][j] = argmin(table[i-1][j-1] + d,
                                             table[i-1][j]+1,
                                             table[i][j-1]+1)
    if showtable:
	# If you are implementing Smith-Waterman, then instead of initializing
	# i=len2 and j=len1, you must initialize i and j to the indices 
	# of the table entry that has the miminum value (it will be negative)
        i = len2
        j = len1
        while i != 0 or j != 0:
            if trace[i][j] == 0:
                nexti = i-1
                nextj = j-1
            elif trace[i][j] == 1:
                nexti = i-1
                nextj = j
            elif trace[i][j] == 2:
                nexti = i
                nextj = j-1
	    else:
		nexti = 0
		nextj = 0
            trace[i][j] = "*"
            i = nexti
            j = nextj
	    print "ij", i, j
        print_table(s1, s2, table, trace)
    return table[len2][len1]

if __name__ == '__main__':
    s1 = "John's (card)."
    s2 = "John 's -LRB- card -RRB ."
    b,e = 9,19 # start from index 1 instead of 0
    (rb, re) = streditmap(s1,s2,b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])
    
    alignObj = alignTable(s1,s2)
    print "New class ********************************"
    (rb, re) = alignObj.mapSpan(b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])
    

    #s1 = u"Egypt conquers Nubia and the Levant (1504 BC\u20131492 BC)."
    #s2 = u"Egypt conquers Nubia and the Levant -LRB- 1504 BC -- 1492 BC -RRB- ."
    s1 = "Cedeides becomes Archon of Athens."
    s2 = "Cedeides becomes Archon of Athens ."
    b,e = 16,len(s2) # start from index 1 instead of 0
    (rb, re) = streditmap(s1,s2,b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])

    alignObj = alignTable(s1,s2)
    print "New class ********************************"
    (rb, re) = alignObj.mapSpan(b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])

    b,e = 1,len(s2)-1 # start from index 1 instead of 0
    (rb, re) = streditmap(s1,s2,b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])

    print "New class ********************************"
    (rb, re) = alignObj.mapSpan(b,e)
    print "\"%s\" => \"%s\"" % (s2[b-1:e], s1[rb:re])

