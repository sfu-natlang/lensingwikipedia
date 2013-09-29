"""
Shared things and consistency settings.
"""

import re
import whoosh, whoosh.index, whoosh.query

comma_char = ","
comma_rep_char = "\t"
comma_re = re.compile(re.escape(comma_char))
comma_rep_re = re.compile(re.escape(comma_rep_char))

# Setting for the 'commas' option when making a schema keyword field
keyword_field_commas = True

# Join keywords for the value of a keyword field
def join_keywords(keywords):
  return comma_char.join(comma_re.sub(comma_rep_char, comma_rep_re.sub(" ", k.strip())) for k in keywords)

# Escape keywords without merging them into a single field value
def escape_keywords(keywords):
  return (comma_re.sub(comma_rep_char, k.strip()) for k in keywords)

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
