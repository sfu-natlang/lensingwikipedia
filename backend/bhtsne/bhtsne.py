#!/usr/bin/env python

'''
A simple Python wrapper for the bh_tsne binary that makes it easier to use it
for TSV files in a pipeline without any shell script trickery.

Note: The script does some minimal sanity checking of the input, but don't
    expect it to cover all cases. After all, it is a just a wrapper.

Example:

    > echo -e '1.0\t0.0\n0.0\t1.0' | ./bhtsne.py -p 0.1
    -2458.83181442  -6525.87718385
    2458.83181442   6525.87718385

The output will not be normalised, maybe the below one-liner is of interest?:

    python -c 'import numpy; d = numpy.loadtxt("/dev/stdin");
        d -= d.min(axis=0); d /= d.max(axis=0);
        numpy.savetxt("/dev/stdout", d, fmt='%.8f', delimiter="\t")'

Author:     Pontus Stenetorp    <pontus stenetorp se>
Version:    2013-01-22
'''

# Copyright (c) 2013, Pontus Stenetorp <pontus stenetorp se>
#
# Permission to use, copy, modify, and/or distribute this software for any
# purpose with or without fee is hereby granted, provided that the above
# copyright notice and this permission notice appear in all copies.
#
# THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
# WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
# MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
# ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
# WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
# ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
# OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

from argparse import ArgumentParser, FileType
from os.path import abspath, dirname, isfile, join as path_join
from shutil import rmtree
from struct import calcsize, pack, unpack
from subprocess import Popen
from sys import stderr, stdin, stdout
from tempfile import mkdtemp
import gzip, string, numpy, sys, json
import featureExtraction
from scipy import sparse
from numpy import *

### Constants
BH_TSNE_BIN_PATH = path_join(dirname(__file__), 'bh_tsne')
assert isfile(BH_TSNE_BIN_PATH), ('Unable to find the bh_tsne binary in the '
    'same directory as this script, have you forgotten to compile it?: {}'
    ).format(BH_TSNE_BIN_PATH)
# Default hyper-parameter values from van der Maaten (2013)
DEFAULT_PERPLEXITY = 30.0
DEFAULT_THETA = 0.5
###


def _argparse():
    argparse = ArgumentParser('bh_tsne Python wrapper')
    argparse.add_argument('-p', '--perplexity', type=float,
            default=DEFAULT_PERPLEXITY)
    # 0.0 for theta is equivalent to vanilla t-SNE
    argparse.add_argument('-t', '--theta', type=float, default=DEFAULT_THETA)

    argparse.add_argument('-v', '--verbose', action='store_true')
    argparse.add_argument('-i', '--input', type=FileType('r'), default=stdin)
    argparse.add_argument('-o', '--output', type=FileType('w'),
            default=stdout)
    argparse.add_argument('-r', '--render', action='store_true')
    argparse.add_argument('-w', '--write', action='store_true')
    return argparse


class TmpDir:
    def __enter__(self):
        self._tmp_dir_path = mkdtemp(dir='Temp/')
        return self._tmp_dir_path

    def __exit__(self, type, value, traceback):
        rmtree(self._tmp_dir_path)


def _read_unpack(fmt, fh):
    return unpack(fmt, fh.read(calcsize(fmt)))

def PCA(dataMatrix, INITIAL_DIMS) :
    """
    Performs PCA on data.
    Reduces the dimensionality to INITIAL_DIMS
    """
    print "Performing PCA"

    dataMatrix= dataMatrix-dataMatrix.mean(axis=0)

    if dataMatrix.shape[1]<INITIAL_DIMS:
        INITIAL_DIMS=dataMatrix.shape[1]

    (eigValues,eigVectors)=linalg.eig(cov(dataMatrix.T))
    perm=argsort(-eigValues)
    eigVectors=eigVectors[:,perm[0:INITIAL_DIMS]]
    return dataMatrix

def bh_tsne(samples, perplexity=DEFAULT_PERPLEXITY, theta=DEFAULT_THETA,
        verbose=False):
    # Assume that the dimensionality of the first sample is representative for
    #   the whole batch
    sample_dim = int(samples.get_shape()[1])
    sample_count = int(samples.get_shape()[0])
    
    # bh_tsne works with fixed input and output paths, give it a temporary
    #   directory to work in so we don't clutter the filesystem
    with TmpDir() as tmp_dir_path:
        # Note: The binary format used by bh_tsne is roughly the same as for
        #   vanilla tsne
        with open(path_join(tmp_dir_path, 'data.dat'), 'wb') as data_file:
            # Write the bh_tsne header
            data_file.write(pack('iidd', sample_count, sample_dim, theta,
                perplexity))
            # Then write the data
            for sample in samples:
                sample = sample.toarray()[0]
                denseSample = []
                for val in sample:
                    denseSample.append(val)
                data_file.write(pack('{}d'.format(len(denseSample)), *denseSample))

        # Call bh_tsne and let it do its thing
        with open('/dev/null', 'w') as dev_null:
            bh_tsne_p = Popen((abspath(BH_TSNE_BIN_PATH), ), cwd=tmp_dir_path,
                    # bh_tsne is very noisy on stdout, tell it to use stderr
                    #   if it is to print any output
                    stdout=stderr if verbose else dev_null)
            bh_tsne_p.wait()
            assert not bh_tsne_p.returncode, ('ERROR: Call to bh_tsne exited '
                    'with a non-zero return code exit status, please ' +
                    ('enable verbose mode and ' if not verbose else '') +
                    'refer to the bh_tsne output for further details')

        # Read and pass on the results
        with open(path_join(tmp_dir_path, 'result.dat'), 'rb') as output_file:
            # The first two integers are just the number of samples and the
            #   dimensionality
            result_samples, result_dims = _read_unpack('ii', output_file)
            # Collect the results, but they may be out of order
            results = [_read_unpack('{}d'.format(result_dims), output_file)
                for _ in xrange(result_samples)]
            # Now collect the landmark data so that we can return the data in
            #   the order it arrived
            results = [(_read_unpack('i', output_file), e) for e in results]
            # Put the results in order and yield it
            results.sort()
            for _, result in results:
                yield result
            # The last piece of data is the cost for each sample, we ignore it
            #read_unpack('{}d'.format(sample_count), output_file)

def main(args):
    argp = _argparse().parse_args(args[1:])

    # Read the data
    data = []
    titles = []
    #gzipFile = gzip.open("data/english-embeddings.turian.txt.gz")

    #for line in gzipFile:
    #    tokens = string.split(line)
    #    titles.append(tokens[0])
    #    data.append([float(f) for f in tokens[1:]])
    #data = numpy.array(data)
    print "Reading Data"    
    lensingJson = featureExtraction.readData('data/fullData.json')
     
    #ExtractBagOfWord features
    print "Extracting Features"
    data = featureExtraction.extBagOfWordFeatures(lensingJson)
    
    for i in range(0,len(lensingJson)):
        titles.append(str(i))
    
    #Call PCA
    data = PCA(data,30)
    
    #call bh_tsne and get the results. Zip the titles and results for writing
    result = bh_tsne(data, perplexity=argp.perplexity, theta=argp.theta, 
        verbose=argp.verbose)
    
    #render image
    if argp.render:
        print "Rendering Image"
        import render
        render.render([(title, point[0], point[1]) for title, point in zip(titles, result)], "output/lensing500p30-data.rendered.png", width=3000, height=1800) 
    

    #convert result into json and write it
    if argp.write:
        print "Writing data to file"
        resData = {}
        minx = 0
        maxx = 0
        miny = 0
        maxy = 0
        for (title,result) in zip(titles,[[res[0],res[1]] for res in result]):
            resData[title] = {'x':result[0], 'y':result[1]}
            if minx > result[0]: minx = result[0]
            if maxx < result[0]: maxx = result[0]
            if miny > result[1]: miny = result[1]
            if maxy < result[1]: maxy = result[1]
        
        print "creating json" 
        print len(resData)
        jsonStr = json.dumps(resData)
        print "MinX - %s MaxX - %s MinY - %s MaxY - %s" % (minx, maxx, miny, maxy)
        with open('output/coordinateslensing.json','w') as outFile:
            outFile.write("jsonstr = ");
            outFile.write(jsonStr+'\n')

if __name__ == '__main__':
    from sys import argv
    exit(main(argv))


