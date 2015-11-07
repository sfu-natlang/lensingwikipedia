"""
Domain-specific adjustments to the default server settings.
"""

import avherald

settings = {
  'server': {
  },
  'querier': {
    'fields_to_prime': ['role', 'predicate', 'event', 'year'] + avherald.facet_field_names,
    'fields_for_text_searches': ['description', 'role', 'predicate', 'event', 'year'] + avherald.facet_field_names
  }
}
