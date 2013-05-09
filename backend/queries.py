"""
Query (frontend to backend) handling.
"""

import sys
import collections
import sha
import json
import dates
import sdbutils
import caching

def discover_year_range(data_dom):
  """
  Work out the minimum year and year digit padding.
  We just look at a single event and hope the data is consistent.
  """
  rs = data_dom.select("select `year`,`yearKey` from `%s` limit %i" % (data_dom.name, 1), max_items=1)
  for item in rs:
    year = int(item['year'])
    year_key_digits = len(item['yearKey'])
    min_year = year - int(item['yearKey'])
    return min_year, year_key_digits

class Querier:
  """
  Query handler. Should be able to operate independently of any other query handler.
  """

  def __init__(self, **settings):
    """
    Make new querier. All arguments are keyword arguments. See the comments in
    the method body for more information.
    """

    # SimpleDB domain for main data
    assert 'data_dom' in settings
    # SimpleDB domain for cluster information
    assert 'cluster_dom' in settings
    # All possible predicate argument numbers
    settings.setdefault('all_argument_numbers', [0, 1])
    # Number of events on a page of descriptions
    settings.setdefault('description_page_size', 10)
    # Number of pages of the initial (empty conditional) query to cache
    settings.setdefault('num_initial_description_pages_to_cache', 10)
    # Minimum possible year
    settings.setdefault('min_year', None)
    # Number of digits in a year key (for sorting)
    settings.setdefault('year_key_digits', None)
    # Name of the clustering to use
    settings.setdefault('clustering_name', None)

    for key, value in settings.iteritems():
      setattr(self, key, value)

    self.response_cache = caching.Complete()
    self.description_paginator = sdbutils.QueryPaginator(default_page_size=self.description_page_size)

    if self.min_year is None or self.year_key_digits is None:
      min_year, year_key_digits = discover_year_range(self.data_dom)
      if self.min_year is None:
        self.min_year = min_year
      if self.year_key_digits is None:
        self.year_key_digits = year_key_digits

  def expand_field(self, field):
    """
    Maps a requested field (which may be a pseudo-field) into a list of actual
    database field names.
    """
    if field == 'role':
      return ["roleA%i" % (an) for an in self.all_argument_numbers]
    else:
      return [field]

  def constraint_to_sdb_query(self, cnstr):
    """
    Produces a SimpleDB select expression representing a single constraint.
    cnstr: The constraint as JSON (as python objects).
    """

    type = cnstr['type']
    if type == 'fieldvalue':
      use_fields = self.expand_field(cnstr['field'])
      return " or ".join("`%s` = '%s'" % (f, cnstr['value'].replace("'", "''")) for f in use_fields)
    elif type == "timerange":
      low = dates.year_key(cnstr['low'], self.min_year, self.year_key_digits)
      high = dates.year_key(cnstr['high'], self.min_year, self.year_key_digits)
      return "yearKey >= '%s' and yearKey <= '%s'" % (low, high)
    elif type == 'mapclusters':
      detail_level = int(cnstr['detaillevel'])
      ids = cnstr['ids']
      return "`mapClustering:%s:%i` in (%s)" % (self.clustering_name, detail_level, ",".join("'%s'" % (i) for i in ids))
    else:
      raise ValueError("unknown constraint type \"%s\"" % (type))

  def generate_field_counts(self, response, views, sdb_query):
    """
    Handles all the count by field value views for a query. All values of a
    multiple-valued field are counted.
    """

    for view in views.itervalues():
      view['_use_fields'] = self.expand_field(view['field'])
    field_keys = set(f for v in views.itervalues() for f in v['_use_fields'])

    for view_id, view in views.iteritems():
      response[view_id] = { 'counts': {} }

    for item in sdbutils.select_all(self.data_dom, sdb_query, field_keys, needs_non_null=field_keys, non_null_is_any=True):
      for view_id, view in views.iteritems():
        counts = response[view_id]['counts']
        for field in view['_use_fields']:
          if field in item:
            values = item[field]
            values = values if isinstance(values, list) else [values]
            for value in values:
              counts.setdefault(value, 0)
              counts[value] += 1

  def handle_independent_view(self, view, sdb_query):
    """
    Handles one of the views which is done on its own independent DB query.
    """

    type = view['type']
    if type == 'descriptions':
      page_num = view['page'] if 'page' in view else 0
      result = { 'more': True }
      def on_last_page():
        result['more'] = False
      rs = sdbutils.select_all(self.data_dom, sdb_query, ['year', 'descriptionHtml'], paginated=(self.description_paginator, page_num), last_page_callback=on_last_page, needs_non_null=['yearKey'], order='yearKey', order_descending=True)
      result['descriptions'] = [dict(e) for e in rs]
      return result
    elif type == 'mapclustersinfo':
      query_parts = [sdb_query, "clustering = '%s'" % (self.clustering_name)]
      if 'detaillevel' in view:
        query_parts.append("detaillevel = '%s'" % (view['detaillevel']))
      sdb_query = " and ".join("(%s)" % (q) for q in query_parts if len(q) > 0)
      rs = sdbutils.select_all(self.cluster_dom, sdb_query, ['detaillevel', 'id', 'latitude', 'longitude'])
      result = {}
      for item in rs:
        result.setdefault(item['detaillevel'], {})
        result[item['detaillevel']][item['id']] = { 'centre': (item['longitude'], item['latitude']) }
      return result
    else:
      raise ValueError("unknown view type \"%s\"" % (type))

  def generate_views(self, response, views, sdb_query):
    """
    Produces the JSON (as python objects) response for the view requests.
    response: Response JSON (as python objects) to put output in.
    views: The views as dictionary of JSON (as python objects) views, keyed by their IDs.
    sdb_query: The SimpleDB select expression for the current query.
    """

    # We defer all the count by field value views until the end so we can do them all on a single DB query. We also rewrite some other queries in terms of field value views.
    field_count_views = {}

    for view_id, view in views.iteritems():
      type = view['type']
      if type == 'countbyfieldvalue':
        field_count_views[view_id] = view
      elif type == 'countbymapcluster':
        field_count_views[view_id] = {
          'type': 'countbyfield',
          'field': 'mapClustering:%s:%s' % (self.clustering_name, view['detaillevel'])
        }
      elif type == 'countbyyear':
        field_count_views[view_id] = {
          'type': 'countbyfield',
          'field': 'year'
        }
      else:
        response[view_id] = self.handle_independent_view(view, sdb_query)

    if len(field_count_views) > 0:
      self.generate_field_counts(response, field_count_views, sdb_query)

    return response

  def should_cache(self, query, view):
    """
    Predicate determining which views to cache.
    query: The whole query being processed.
    views: The particular view to consider caching.
    """
    return len(query['constraints']) == 0 \
      and (int(view['page'] if 'page' in view else 0) < self.num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

  def handle(self, query, query_str=None):
    """
    Produces a JSON (as python objects) response for a query given as a JSON (as
    python objects) query.
    query: The query as JSON (as python objects).
    query_str: A canonical (ie will be consistent between different requests for
      the same view) string for the whole query; if not given then one will be
      generated as needed.
    """

    def handle_constraint(cnstr_id, cnstr):
      print >> sys.stderr, "handling constraint \"%s\" of type \"%s\"" % (cnstr_id, cnstr['type'])
      return self.constraint_to_sdb_query(cnstr)
    sdb_query = " and ".join("(%s)" % (handle_constraint(cid, c)) for cid, c in query['constraints'].iteritems())

    response = {}
    needed_views = {}
    views_to_cache = {}
    for view_id, view in query['views'].iteritems():
      method_str = None
      if self.should_cache(query, view):
        if query_str is None:
          query_str = json.dumps(query)
        shaer = sha.new(query_str)
        shaer.update(json.dumps(view))
        cache_key = shaer.digest()
        view_response = self.response_cache.get(cache_key)
        if view_response is None:
          method_str = "generating view for cache"
          views_to_cache[view_id] = cache_key
          needed_views[view_id] = view
        else:
          method_str = "using cache"
          response[view_id] = view_response
      else:
        method_str = "generating view"
        needed_views[view_id] = view
      print >> sys.stderr, "handling view \"%s\" of type \"%s\": %s" % (view_id, view['type'], method_str)

    self.generate_views(response, needed_views, sdb_query)

    for view_id, cache_key in views_to_cache.iteritems():
      self.response_cache[cache_key] = response[view_id]

    return response
