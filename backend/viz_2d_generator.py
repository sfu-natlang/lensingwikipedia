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
from collections import defaultdict

def iter_events_from_index(index):
    log('Reading data from index')
    sentence_feature_str = defaultdict(list)
    temp_metadata = {}
    features_strings = []
    metadata = []
    with index.searcher() as searcher:
        for i, hit in enumerate(searcher.search(whoosh.query.Every(), limit=None)):
            text = hit['sentence']
            feature_string = hit['role']
            if feature_string:
                if text in sentence_feature_str:
                    sentence_feature_str[text].append(feature_string)
                else:
                    sentence_feature_str[text].append(feature_string)
                    temp_metadata[text] = (i, hit['id]'])

    for key, value in sentence_feature_str.iteritems():
        feature_strings.append(', '.join(value))
        metadata.append(temp_metadata[key])
    sentence_feature_str = None
    temp_metadata = None
    return feature_strings, metadata




def extract_features(feature_strings):
    features = viz_feature_extractor.extract_features(feature_strings)
    feature_strings = None
    return metadata, features


def run(input_index, perplexity, theta, pca_dimensions, verbose, output_index, doc_buffer_size, do_dummy):
    lookup = {}
    feature_string, metadata = iter_events_from_index(input_index)
    features = extract_features(feature_string)
    log('Features extracted: ' + str(features.shape))
    log('Metadata length: ' + str(len(metadata)))
    
    if pca_dimensions is not None:
        log('PCA: reducing dimensions to ' + str(pca_dimensions))
        features = tsne.pca(features, pca_dimensions)

    log('Executing bh-tSNE')
    coordinates = tsne.bh_tsne(features, perplexity, theta, verbose)

    total_coordinates = 0
    for (metadatum, coordinate) in zip(metadata, coordinates):
        log(str(metadatum))
        i, id = metadatum
        lookup[id] = coordinate
        total_coordinates += 1
    log('Coordinates extracted: ' + str(total_coordinates))


    if not do_dummy:
        writer = output_index.writer()
        try:
            writer.add_field('2DtSNECoordinates', whoosh.fields.KEYWORD(stored=True, commas=whooshutils.keyword_field_commas))
        except whoosh.fields.FieldConfigurationError:
            pass

        def modify(event):
            if event['id'] in lookup:
                coordinate = lookup[event['id']]
                coordinate = ['%f,%f' % (coordinate[0], coordinate[1])]
            else:
                coordinate = []
            event['2DtSNECoordinates'] = unicode(whooshutils.join_keywords(coordinate))

        if doc_buffer_size is not None:
            whooshutils.update_all_in_place(input_index, writer, modify, 'id', buffer_size=doc_buffer_size)
        else:
            whooshutils.copy_all(input_index, writer, modify)

        log(whooshutils.large_change_commit_message)
        writer.commit()
        log("Index commit complete.")


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
    if do_dummy:
        log('##################### DUMMY RUN #####################')
    else:
        log('##################### THIS IS NOT A DUMMY RUN #####################')

    run(input_index, perplexity, theta, pca_dimensions, verbose, output_index, doc_buffer_size, do_dummy)
