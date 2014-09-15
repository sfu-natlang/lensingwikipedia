#!/usr/bin/env python2

"""
Usage: %s [opts] WHOOSH-INDEX-DIR [OUTPUT-WHOOSH-INDEX-DIR]

Options:
  -D        Do dummy clustering; find cluster sizes and centres but don't
    actually output a new index.
  -b NUM    Number of events to keep in memory at once if writing in-place.
  -P NUM    If want to run PCA then the number of dimensions to reduce to.
  -p FLOAT  The perplexity value for bh-tSNE
  -t FLOAT  The theta value for bh-tSNE
  -v        Verbose bh-tSNE


Arguments:
WHOOSH-INDEX-DIR         Directory of the Whoosh index for the input data.
OUTPUT-WHOOSH-INDEX-DIR  Directory of the Whoosh index for the output data.

Generate 2D Visualization coordinates for data indexed in Whoosh.

1. Read data from Whoosh and extract the required text.
2. Perform feature extraction.
3. Calculate 2d coordinates using BH-tSNE.
4. Index data back into Whoosh.
"""

import sys
import os, os.path
import whoosh, whoosh.index
import viz_feature_extractor
import whooshutils
import bhtsne.bhtsne as tsne


def iter_events_from_index(index):
    log('Reading data from index')
    with index.searcher() as searcher:
        for i, hit in enumerate(searcher.search(whoosh.query.Every(), limit=None)):
            sentence = hit['sentence']
            if sentence:
                yield i, hit['id'], sentence


def extract_features(data):
    features = viz_feature_extractor.extract_features((sentence for (i, id, sentence) in data))
    return features


def run(input_index, perplexity, theta, pca_dimensions, verbose, output_index, doc_buffer_size, do_dummy):
    data = iter_events_from_index(input_index)
    features = extract_features(data)
    log('Features extracted: ' + str(features.shape))
    
    if pca_dimensions:
        log('PCA: reducing dimensions to ' + str(pca_dimensions))
        features = tsne.pca(features, pca_dimensions)

    log('Executing bh-tSNE')
    coordinates = tsne.bh_tsne(features, perplexity, theta, verbose)
    log('Executed bh-tSNE, total coordinates: ' + str(coordinates.shape))


def log(log_str):
    sys.stderr.write(log_str+'\n')


if __name__ == '__main__':
    import getopt

    log('Initializing 2D Visualization Coordinate Generator')

    try:
        opts, args = getopt.getopt(sys.argv[1:], "P:Db:p:t:v")
        if len(args) not in [1, 2]:
            raise getopt.GetoptError("wrong number of positional arguments")
        opts = dict(opts)
    except getopt.GetoptError:
        print >> sys.stderr, __doc__.strip('\n\r') % (sys.argv[0])
        sys.exit(1)

    log('Arguments read')

    input_index_path = args[0]
    output_index_path = args[1] if len(args) > 1 else None
    do_dummy = '-D' in opts
    doc_buffer_size = None if output_index_path is not None else (int(opts['-b']) if '-b' in opts else 1000)

    #bh-tSNE options
    pca_dimensions = int(opts['-P']) if '-P' in opts else None
    perplexity = float(opts['-p']) if '-p' in opts else tsne.DEFAULT_PERPLEXITY
    theta = float(opts['-t']) if '-t' in opts else tsne.DEFAULT_THETA
    verbose = '-v' in opts



    if output_index_path is not None and not os.path.exists(output_index_path):
        os.mkdir(output_index_path)
    input_index = whoosh.index.open_dir(input_index_path)
    output_index = (whoosh.index.create_in(output_index_path, input_index.schema.copy())
                    if output_index_path is not None else input_index) if not do_dummy else None

    log('')
    log('Index loaded, generating coordinates for 2D visualization using the arguments; perplexity: ' + str(perplexity) + ', theta: ' + str(theta) + ', pca_dimensions: ' + str(pca_dimensions))
    run(input_index, perplexity, theta, pca_dimensions, verbose, output_index, doc_buffer_size, do_dummy)




