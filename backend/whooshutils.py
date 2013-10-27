"""
Shared things and consistency settings.
"""

import re
import whoosh, whoosh.index, whoosh.query, whoosh.qparser

# Separator for parts of the merged fields (must be something that whoosh will count as a distinct but otherwise unknown token, and not as whitespace)
merge_field_sep = " _SEP_ "
# Suffix for the field name of a text field mirroring a keyword field for searching purposes
keyword_field_free_text_suffix = "_freeText"
# Field name for merged version of all text and keyword fields
all_text_merge_field = "all%s"% (keyword_field_free_text_suffix)

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

class TextQueryParser(whoosh.qparser.QueryParser):
  def __init__(self, schema):
    super(TextQueryParser, self).__init__(all_text_merge_field, schema=schema)

  def parse(self, text):
    # We need to adjust the field names and make search terms lowercase.
    # Note that commas here will already be interpreted by the query parser as whitespace, so we don't need to escape them.
    def alter(node):
      new_node = node
      if hasattr(node, 'fieldname') and isinstance(self.schema[node.fieldname], whoosh.fields.KEYWORD):
        new_node = node.copy()
        new_node.fieldname = "%s%s" % (node.fieldname, keyword_field_free_text_suffix)
      if hasattr(node, 'text'):
        if new_node is node:
          new_node = node.copy()
        new_node.text = node.text.lower()
      return new_node.apply(alter)
    query = super(TextQueryParser, self).parse(text)
    return alter(query)

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
