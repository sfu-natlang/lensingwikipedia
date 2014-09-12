#!/usr/bin/env python2

"""
Extract features for visualization of text using tSNE.
"""
import sys
from string import punctuation
from sklearn.feature_extraction.text import CountVectorizer
from nltk.corpus import stopwords
from nltk import word_tokenize

stop_words = set(stopwords.words("english"))


def extract_features(sentences):
    """
    Extract bag of word features with counts
    :param sentences:
    :return:
    """
    corpus = []
    
    sys.stderr.write('\n')
    sys.stderr.write('Extracting features for 2D Visualization\n')
    
    for sentence in sentences:
        
        sys.stderr.write("Features for: %s" % (sentence + '\n'))

        tokens = word_tokenize(sentence.lower())
        filtered_tokens = ' '.join([token for token in tokens if token not in stop_words and token not in punctuation])
        corpus.append(filtered_tokens)

    vectorizer = CountVectorizer(min_df=0, dtype='Float64')
    features = vectorizer.fit_transform(corpus)
    return features
