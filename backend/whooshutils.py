"""
Shared things and consistency settings.
"""

# Setting for the 'commas' option when making a schema keyword field
keyword_field_commas = True

# Join keywords for the value of a keyword field
def join_keywords(keywords):
  return ",".join(keywords)

# Separate the value of a keyword field into separate keywords
def split_keywords(value):
  if isinstance(value, unicode):
    if len(value) == 0:
      return []
    else:
      return value.split(",")
  else:
    return [value]
