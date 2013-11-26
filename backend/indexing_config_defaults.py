"""
Configuration for indexing.

If making only local changes, don't alter the default indexing configuration;
see the readme for more information.
"""

import wikipediahistory

# Number of role argument fields.
num_role_arguments = 6

# List of names for extra keyword fields (especially for facets).
extra_keyword_field_names = wikipediahistory.facet_field_names

# List of functions to provide values for an event document given Json data for the event. Each function should return a dict-like object that provides any number of field names and values. Value can be non-unicode strings, numeric values, or iterables (for multiple keyword values), all of which will be converted to appropriate values for whoosh. The functions are applied in order. Together they should set at least all the required fields except for dbid.
value_getters = [
  wikipediahistory.get_required_field_values(num_role_arguments),
  wikipediahistory.get_facet_field_values
]
