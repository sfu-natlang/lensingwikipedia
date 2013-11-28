"""
Configuration for indexing.
"""

import avherald

num_role_arguments = 6

extra_keyword_field_names = avherald.facet_field_names
description_field_names = avherald.description_field_names

value_getters = [
  avherald.get_required_field_values(num_role_arguments),
  avherald.get_facet_field_values
]

field_name_aliases = {
  'id': 'dbid',
  'predicate': 'eventRoot',
  'location': 'locationText',
  'currentcountry': 'currentCountryText',
  'person': 'personText',
  'category': 'categoryText'
}.get
