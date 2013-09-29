"""
Shared things and consistency settings.
"""

import re

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
