"""
Query (frontend to backend) handling.
"""

import sys
import collections
import sha
import json
import dates
import sdbutils
import cache

class QuerySettings:
  def __init__(self):
    # Minimum possible year
    self.min_year = None
    # Number of digits in a year key (for sorting)
    self.year_key_digits = None
    # Name of the clustering to use
    clustering_name = None

# All possible predicate argument numbers
all_argument_numbers = [0, 1]
# Number of events on a page of descriptions
description_page_size = 10
# Number of pages of the initial (empty conditional) query to cache
num_initial_description_pages_to_cache = 10

response_cache = cache.Complete()

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

def expand_field(field):
  """
  Maps a requested field (which may be a pseudo-field) into a list of actual
  database field names.
  """
  if field == 'role':
    return ["roleA%i" % (an) for an in all_argument_numbers]
  else:
    return [field]

def constraint_to_sdb_query(cnstr, settings):
  """
  Produces a SimpleDB select expression representing a single constraint.
  cnstr: The constraint as JSON (as python objects).
  settings: Settings for handling a query.
  """

  type = cnstr['type']
  if type == 'fieldvalue':
    use_fields = expand_field(cnstr['field'])
    return " or ".join("`%s` = '%s'" % (f, cnstr['value'].replace("'", "''")) for f in use_fields)
  elif type == "timerange":
    low = dates.year_key(cnstr['low'], settings.min_year, settings.year_key_digits)
    high = dates.year_key(cnstr['high'], settings.min_year, settings.year_key_digits)
    return "yearKey >= '%s' and yearKey <= '%s'" % (low, high)
  elif type == 'mapclusters':
    detail_level = int(cnstr['detaillevel'])
    ids = cnstr['ids']
    return "`mapClustering:%s:%i` in (%s)" % (settings.clustering_name, detail_level, ",".join("'%s'" % (i) for i in ids))
  else:
    raise ValueError("unknown constraint type \"%s\"" % (type))

def generate_field_counts(response, views, sdb_query, data_dom):
  """
  Handles all the count by field value views for a query. All values of a
  multiple-valued field are counted.
  """

  for view in views.itervalues():
    view['_use_fields'] = expand_field(view['field'])
  field_keys = set(f for v in views.itervalues() for f in v['_use_fields'])

  for view_id, view in views.iteritems():
    response[view_id] = { 'counts': {} }

  for item in sdbutils.select_all(data_dom, sdb_query, field_keys, needs_non_null=field_keys, non_null_is_any=True):
    for view_id, view in views.iteritems():
      counts = response[view_id]['counts']
      for field in view['_use_fields']:
        if field in item:
          values = item[field]
          values = values if isinstance(values, list) else [values]
          for value in values:
            counts.setdefault(value, 0)
            counts[value] += 1

def handle_independent_view(view, sdb_query, data_dom, cluster_dom, settings):
  """
  Handles one of the views which is done on its own independent DB query.
  """

  type = view['type']
  if type == 'descriptions':
    page_num = view['page'] if 'page' in view else 0
    result = { 'more': True }
    def on_last_page():
      result['more'] = False
    rs = sdbutils.select_all(data_dom, sdb_query, ['year', 'descriptionHtml'], paginated=(description_page_size, page_num), last_page_callback=on_last_page, needs_non_null=['yearKey'], order='yearKey', order_descending=True)
    result['descriptions'] = [dict(e) for e in rs]
    return result
  elif type == 'mapclustersinfo':
    query_parts = [sdb_query, "clustering = '%s'" % (settings.clustering_name)]
    if 'detaillevel' in view:
      query_parts.append("detaillevel = '%s'" % (view['detaillevel']))
    sdb_query = " and ".join("(%s)" % (q) for q in query_parts if len(q) > 0)
    rs = sdbutils.select_all(cluster_dom, sdb_query, ['detaillevel', 'id', 'latitude', 'longitude'])
    result = {}
    for item in rs:
      result.setdefault(item['detaillevel'], {})
      result[item['detaillevel']][item['id']] = { 'centre': (item['longitude'], item['latitude']) }
    return result
  else:
    raise ValueError("unknown view type \"%s\"" % (type))

def generate_views(response, views, sdb_query, data_dom, cluster_dom, settings):
  """
  Produces the JSON (as python objects) response for the view requests.
  response: Response JSON (as python objects) to put output in.
  views: The views as dictionary of JSON (as python objects) views, keyed by their IDs.
  sdb_query: The SimpleDB select expression for the current query.
  data_dom: The SimpleDB domain for the data.
  cluster_dom: The SimpleDB domain for clustering information.
  settings: Settings for handling a query.
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
        'field': 'mapClustering:%s:%s' % (settings.clustering_name, view['detaillevel'])
      }
    elif type == 'countbyyear':
      field_count_views[view_id] = {
        'type': 'countbyfield',
        'field': 'year'
      }
    else:
      response[view_id] = handle_independent_view(view, sdb_query, data_dom, cluster_dom, settings)

  if len(field_count_views) > 0:
    generate_field_counts(response, field_count_views, sdb_query, data_dom)

  return response

def should_cache(query, view):
  """
  Predicate determining which views to cache.
  query: The whole query being processed.
  views: The particular view to consider caching.
  """
  return len(query['constraints']) == 0 \
    and (int(view['page'] if 'page' in view else 0) < num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

def handle_query(query, data_dom, cluster_dom, settings, query_str=None):
  """
  Produces a JSON (as python objects) response for a query given as a JSON (as
  python objects) query.
  query: The query as JSON (as python objects).
  data_dom: The SimpleDB domain for the data.
  cluster_dom: The SimpleDB domain for clustering information.
  settings: Settings for handling a query.
  query_str: A canonical (ie will be consistent between different requests for
    the same view) string for the whole query; if not given then one will be
    generated as needed.
  """

  def handle_constraint(cnstr_id, cnstr):
    print >> sys.stderr, "handling constraint \"%s\" of type \"%s\"" % (cnstr_id, cnstr['type'])
    return constraint_to_sdb_query(cnstr, settings)
  sdb_query = " and ".join("(%s)" % (handle_constraint(cid, c)) for cid, c in query['constraints'].iteritems())

  response = {}
  needed_views = {}
  views_to_cache = {}
  for view_id, view in query['views'].iteritems():
    method_str = None
    if should_cache(query, view):
      if query_str is None:
        query_str = json.dumps(query)
      shaer = sha.new(query_str)
      shaer.update(json.dumps(view))
      cache_key = shaer.digest()
      view_response = response_cache.get(cache_key)
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

  generate_views(response, needed_views, sdb_query, data_dom, cluster_dom, settings)

  for view_id, cache_key in views_to_cache.iteritems():
    response_cache[cache_key] = response[view_id]

  return response
