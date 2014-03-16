"""
The default settings for the backend. A settings file should be a single python
dict in the same format as the one below. This file can be used as a template,
just remove this header comment and the "settings = ". In a settings file any
setting not specified will use its default value.
"""
settings = {
  'server': {
    # Path to the Whoosh index directory for a running server; must be set for a running server (default may be changed by the backend program)
    'index_dir_path': None,
    # Timeout before reloading all settings
    'settings_timeout': 60 * 60,
    # Force a complete reset (clearing caches) at each settings reload (versus only if the Whoosh index changed)
    'always_reset': False,
    # Verbose logging output to standard error
    'verbose': False
  },
  'querier': {
    # All possible predicate argument numbers
    'all_argument_numbers': [0, 1, 2, 3, 4],
    # Number of events on a page of descriptions
    'description_page_size': 25,
    # Number of events on a page of count by reference point results
    'count_by_referencepoint_page_size': 50,
    # Number of pages of the initial (empty constraint, query to cache
    'num_initial_description_pages_to_cache': 10,
    # Size of the cache for result pagination (cached results for pagination done on the backend
    'result_pagination_cache_size': 100,
    # Names of fields to prime the cache with
    'fields_to_prime': ["role", "location", "person", "currentcountry"],
    # Names of fields to use for text searches if no fields are specified in the query
    'fields_for_text_searches': ["description", "role", "location", "person", "currentcountry"],
    # Number of events on a page of count by field value results
    'count_by_field_value_page_size': 50,
    # Number of events on a page of count by year results
    'count_by_year_page_size': 50,
    # Verbose logging output to standard error
    'verbose': False
  }
}
