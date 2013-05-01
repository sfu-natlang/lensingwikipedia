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

def discover_year_range(data_dom):
  """
  Work out the minimum year and year digit padding.
  We just look at a single event and hope the data is consistent.
  """
  rs = data_dom.select("select `year`,`yearKey` from `%s` limit %i" % (data_dom.name, 1), max_items=1)
  for item in rs:
    year = int(item['year'])
    year_key_digits = len(item['yearKey']) + (1 if year >= 0 else 0)
    min_year = year - int(item['yearKey'])
    return min_year, year_key_digits

# All possible predicate argument numbers
all_argument_numbers = [0, 1]
# Number of events on a page of descriptions
description_page_size = 10
# Number of pages of the initial (empty conditional) query to cache
num_initial_description_pages_to_cache = 10

response_cache = cache.Complete()

def count_by(sdb_result, key):
  """
  Count items by the value of a specified key. Each value of a multiple-valued
  field is counted.
  """
  table = {}
  for item in sdb_result:
    item_key = key(item)
    values = item_key if isinstance(item_key, list) else [item_key]
    for value in values:
      table.setdefault(value, 0)
      table[value] += 1
  return { 'counts': table }

def constraint_to_sdb_query(cnstr, settings):
  """
  Produces a SimpleDB select expression representing a single constraint.
  cnstr: The constraint as JSON (as python objects).
  settings: Settings for handling a query.
  """

  type = cnstr['type']
  if type == 'role':
    def part(arg_num, role):
      return "roleA%i = '%s'" % (arg_num, role)
    arg_nums = [int(cnstr['arg'])] if 'arg' in cnstr else all_argument_numbers
    role = cnstr['role']
    return " or ".join(part(an, cnstr['role']) for an in arg_nums)
  elif type == "timerange":
    low = dates.year_key(cnstr['low'], settings.min_year, settings.year_key_digits)
    high = dates.year_key(cnstr['high'], settings.min_year, settings.year_key_digits)
    return "yearKey >= '%s' and yearKey <= '%s'" % (low, high)
  elif type == 'mapclusters':
    detail_level = int(cnstr['detail'])
    ids = cnstr['ids']
    return "mapClustering:%s:%i in (%s)" % (settings.clustering_name, detail_level, ",".join("'%i'" % (i) for i in ids))
  elif type == 'location':
    return "`locationText` = '%s'" % (cnstr['text'])
  elif type == "mapclustersinfo":
    return "detaillevel = '%s'" % (cnstr['detaillevel'])
  else:
    raise ValueError("unknown constraint type \"%s\"" % (type))

def generate_view(view, sdb_query, data_dom, cluster_dom, settings):
  """
  Produces the JSON (as python objects) response for a single view request.
  view: The view as JSON (as python objects).
  sdb_query: The SimpleDB select expression for the current query.
  data_dom: The SimpleDB domain for the data.
  settings: Settings for handling a query.
  """

  # TODO: wherever possible this should do multiple views from a single database query

  type = view['type']
  if type == 'descriptions':
    page_num = view['page'] if 'page' in view else 0
    response = { 'more': True }
    def on_last_page():
      response['more'] = False
    rs = sdbutils.select_all(data_dom, sdb_query, ['year', 'descriptionHtml'], paginated=(description_page_size, page_num), last_page_callback=on_last_page, needs_non_null=['yearKey'], order='yearKey', order_descending=True)
    response['descriptions'] = [dict(e) for e in rs]
    return response
  elif type == 'countbyrole':
    arg_nums = [int(view['arg'])] if 'arg' in view else all_argument_numbers
    arg_keys = ["roleA%i" % (an) for an in arg_nums]
    rs = sdbutils.select_all(data_dom, sdb_query, arg_keys)
    table = {}
    for item in rs:
      for key in arg_keys:
        if key in item:
          role = item[key]
          table.setdefault(role, 0)
          table[role] += 1
    return { 'counts': table }
  elif type == 'countbymapcluster':
    cluster_key = 'mapClustering:%s:%s' % (settings.clustering_name, view['detaillevel'])
    print >> sys.stderr, 'KEY', cluster_key, view
    rs = sdbutils.select_all(data_dom, sdb_query, [cluster_key], needs_non_null=[cluster_key])
    return count_by(rs, lambda e: e[cluster_key])
  elif type == 'countbyyear':
    rs = sdbutils.select_all(data_dom, sdb_query, ['year'], needs_non_null=['year'])
    return count_by(rs, lambda e: e['year'])
  elif type == 'countbylocation':
    rs = sdbutils.select_all(data_dom, sdb_query, ['locationText'], needs_non_null=['locationText'])
    return count_by(rs, lambda e: e['locationText'])
  elif type == 'mapclustersinfo':
    detail_levels = [int(dl) for dl in view['detaillevel']] if 'detaillevel' in view else []
    query_parts = [sdb_query, "clustering = '%s'" % (settings.clustering_name)]
    sdb_query = " and ".join("(%s)" % (q) for q in query_parts if len(q) > 0)
    rs = sdbutils.select_all(cluster_dom, sdb_query, ['detaillevel', 'id', 'latitude', 'longitude'])
    response = {}
    for item in rs:
      response.setdefault(item['detaillevel'], {})
      response[item['detaillevel']][item['id']] = { 'centre': (item['latitude'], item['longitude']) }
    return response
  else:
    raise ValueError("unknown view type \"%s\"" % (type))

def do_cache(query, view):
  return len(query['constraints']) == 0 \
    and (int(view['page'] if 'page' in view else 0) < num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

def handle_query(query, data_dom, cluster_dom, settings, query_str=None):
  """
  Produces a JSON (as python objects) response for a query given as a JSON (as
  python objects) query.
  query: The query as JSON (as python objects).
  data_dom: The SimpleDB domain for the data.
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
  for view_id, view in query['views'].iteritems():
    print >> sys.stderr, "handling view \"%s\" of type \"%s\"" % (view_id, view['type'])
    if do_cache(query, view):
      if query_str is None:
        query_str = json.dumps(query)
      shaer = sha.new(query_str)
      shaer.update(json.dumps(view))
      cache_key = shaer.digest()
      view_response = response_cache.get(cache_key)
      if view_response is None:
        print >> sys.stderr, "generating view for cache"
        view_response = generate_view(view, sdb_query, data_dom, cluster_dom, settings)
        response_cache[cache_key] = view_response
      else:
        print >> sys.stderr, "using cache"
      response[view_id] = view_response
    else:
      print >> sys.stderr, "generating view"
      response[view_id] = generate_view(view, sdb_query, data_dom, cluster_dom, settings)
  return response
