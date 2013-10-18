"""
Shared things and consistency settings.
"""

import re
import whoosh, whoosh.index, whoosh.query

# Suffix for the field name of a text field mirroring a keyword field for searching purposes
keyword_field_free_text_suffix = "_freeText"

comma_char = ","
comma_rep_char = "\t"
comma_re = re.compile(re.escape(comma_char))
comma_rep_re = re.compile(re.escape(comma_rep_char))

# Setting for the 'commas' option when making a schema keyword field
keyword_field_commas = True

# Join keywords for the value of a keyword field
def join_keywords(keywords):
  return comma_char.join(comma_re.sub(comma_rep_char, comma_rep_re.sub(" ", k.strip())) for k in keywords)

# Escape a single keyword
def escape_keyword(keyword):
  return comma_re.sub(comma_rep_char, keyword.strip())

# Unescape a single keyword
def unescape_keyword(keyword):
  return comma_rep_re.sub(comma_char, keyword) if isinstance(keyword, unicode) else keyword

# Separate the value of a keyword field into separate keywords
def split_keywords(value):
  if isinstance(value, unicode):
    if len(value) == 0:
      return []
    else:
      return [comma_rep_re.sub(comma_char, p) for p in value.split(comma_char)]
  else:
    return [value]

def update_all_in_place(index, writer, modify_doc, query=whoosh.query.Every(), buffer_size=100):
  with writer.searcher() as searcher:
    page_num = 1
    while True:
      hits = searcher.search_page(query, page_num, pagelen=buffer_size)
      buf = [h.fields() for h in hits]
      for doc in buf:
        modify_doc(doc)
        writer.update_document(**doc)
      if hits.is_last_page():
        break
      page_num += 1

def copy_all(input_index, output_writer, modify_doc, query=whoosh.query.Every()):
  with input_index.searcher() as searcher:
    for hit in searcher.search(query, limit=None):
      event = dict(hit)
      modify_doc(event)
      output_writer.add_document(**event)
