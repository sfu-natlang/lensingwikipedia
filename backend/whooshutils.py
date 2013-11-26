"""
Shared things and consistency settings.
"""

import re
import whoosh, whoosh.index, whoosh.query, whoosh.qparser

# Message for a commit on a large change
large_change_commit_message = "committing (may take a long time)"

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
  def __init__(self, schema, field_map=lambda x: None):
    super(TextQueryParser, self).__init__(all_text_merge_field, schema=schema)
    self.field_map = field_map

    self.remove_plugin_class(whoosh.qparser.FieldsPlugin)
    self.add_plugin(whoosh.qparser.FieldsPlugin(remove_unknown=False))

  def parse(self, text):
    # We need to adjust the field names and make search terms lowercase.
    # Note that commas here will already be interpreted by the query parser as whitespace, so we don't need to escape them.
    def alter(node):
      new_node = node
      if hasattr(node, 'fieldname'):
        mapped_field_name = self.field_map(node.fieldname)
        if mapped_field_name is not None:
          if new_node is node:
            new_node = node.copy()
          node.fieldname = mapped_field_name
        if isinstance(self.schema[node.fieldname], whoosh.fields.KEYWORD) or isinstance(self.schema[node.fieldname], whoosh.fields.ID):
          if new_node is node:
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

def copy_all(input_index, output_writer, modify_doc):
  """
  Copies all documents in a index with updates made by a modify function that is given each document and changes it in-place.
  """
  with input_index.searcher() as searcher:
    for hit in searcher.search(whoosh.query.Every(), limit=None):
      event = dict(hit)
      modify_doc(event)
      output_writer.add_document(**event)

def update_all_in_place(index, writer, modify_doc, order_num_field, buffer_size=100):
  """
  Updates all documents in an index in-place. Requires a numeric field which is unique (to avoid issues with reading and writing at the same time), and buffers some number of documents in memory at once. Otherwise should work like copy_all().
  """
  with writer.searcher() as searcher:
    # We use manual pagination by counting on the unique numeric field because using whoosh's pagination causes some documents to be skipped if we modify documents during the search
    page_num = 0
    while True:
      page_start = page_num * buffer_size
      hits = searcher.search(whoosh.query.NumericRange(order_num_field, page_start, page_start + buffer_size - 1), limit=None, sortedby=order_num_field)
      if hits.is_empty():
        break
      buf = [h.fields() for h in hits]
      for doc in buf:
        modify_doc(doc)
        writer.update_document(**doc)
      page_num += 1
