#!/usr/bin/env python2

"""
Usage: %s [opts] WHOOSH-INDEX-DIR [OUTPUT-WHOOSH-INDEX-DIR]

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


def iter_events_from_index(index):
    sys.stderr.write('Reading data from index\n')
    with index.searcher() as searcher:
        for i, hit in enumerate(searcher.search(whoosh.query.Every(), limit=None)):
            feature_string = hit['role']
            if feature_string:
                yield i, hit['id'], feature_string


def extract_features(data):
    features = viz_feature_extractor.extract_features((feature_string for (i, id, feature_string) in data))
    return features


def run(input_index, output_index, doc_buffer_size, do_dummy):
    data = iter_events_from_index(input_index)
    features = extract_features(data)


if __name__ == '__main__':
    import getopt

    sys.stderr.write('Initializing 2D Visualization Coordinate Generator\n')

    try:
        opts, args = getopt.getopt(sys.argv[1:], ":Db:")
        if len(args) not in [1, 2]:
            raise getopt.GetoptError("wrong number of positional arguments")
        opts = dict(opts)
    except getopt.GetoptError:
        print >> sys.stderr, __doc__.strip('\n\r') % (sys.argv[0])
        sys.exit(1)

    sys.stderr.write('Arguments read\n')

    input_index_path = args[0]
    output_index_path = args[1] if len(args) > 1 else None
    do_dummy = '-D' in opts
    doc_buffer_size = None if output_index_path is not None else (int(opts['-b']) if '-b' in opts else 1000)

    if output_index_path is not None and not os.path.exists(output_index_path):
        os.mkdir(output_index_path)
    input_index = whoosh.index.open_dir(input_index_path)
    output_index = (whoosh.index.create_in(output_index_path, input_index.schema.copy())
                    if output_index_path is not None else input_index) if not do_dummy else None

    sys.stderr.write('\n')
    sys.stderr.write('Index loaded, generating coordinates for 2D visualization\n')
    run(input_index, output_index, doc_buffer_size, do_dummy)




