"""
Configuration for indexing.
"""

import avherald

settings = {
  'querier': {
    'fields_to_prime': ['role', 'predicate', 'event', 'year'] + avherald.facet_field_names,
    'fields_for_text_searches': ['description', 'role', 'predicate', 'event', 'year'] + avherald.facet_field_names
  }
}

num_role_arguments = 6

extra_keyword_field_names = avherald.facet_field_names
description_field_names = avherald.description_field_names
field_name_aliases = avherald.field_name_aliases

value_getters = [
  avherald.get_required_field_values(num_role_arguments),
  avherald.get_facet_field_values
]

field_name_aliases = {}.get
