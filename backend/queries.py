"""
Query (frontend to backend) handling.
"""

import sys
import sdbutils
import cache
import json
import sha

# All possible predicate argument numbers
all_argument_numbers = [0, 1]
# Number of events on a page of descriptions
description_page_size = 10
# Number of pages of the initial (empty conditional) query to cache
num_initial_description_pages_to_cache = 10

response_cache = cache.Complete()

def count_by(sdb_result, key):
  """
  Count items by the value of a specified key.
  """
  table = {}
  for item in sdb_result:
    item_key = key(item)
    table.setdefault(item_key, 0)
    table[item_key] += 1
  return { 'counts': table }

def constraint_to_sdb_query(cnstr, clustering_name):
  """
  Produces a SimpleDB select expression representing a single constraint.
  cnstr: The constraint as JSON (as python objects).
  clustering_name: Name of the clustering to use.
  """

  type = cnstr['type']
  if type == 'role':
    def part(arg_num, role):
      return "roleA%i = '%s'" % (arg_num, role)
    arg_nums = [int(cnstr['arg'])] if 'arg' in cnstr else all_argument_numbers
    role = cnstr['role']
    return " or ".join(part(an, cnstr['role']) for an in arg_nums)
  elif type == "timerange":
    return "time >= '%i' and time <= '%i'" % (cnstr['low'], cnstr['high'])
  elif type == 'mapclusters':
    detail_level = int(cnstr['detail'])
    ids = cnstr['ids']
    return "mapClustering:%s:%i in (%s)" % (clustering_name, detail_level, ",".join("'%i'" % (i) for i in ids))
  else:
    raise ValueError("unknown constraint type \"%s\"" % (type))

def generate_view(view, sdb_query, data_dom, clustering_name):
  """
  Produces the JSON (as python objects) response for a single view request.
  view: The view as JSON (as python objects).
  sdb_query: The SimpleDB select expression for the current query.
  data_dom: The SimpleDB domain for the data.
  clustering_name: Name of the clustering to use.
  """

  # TODO: wherever possible this should do multiple views from a single database query

  type = view['type']
  if type == 'descriptions':
    page_num = view['page'] if 'page' in view else 0
    response = { 'more': True }
    def on_last_page():
      response['more'] = False
    rs = sdbutils.select_all(data_dom, sdb_query, ['year', 'descriptionHtml'], paginated=(description_page_size, page_num), last_page_callback=on_last_page)
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
    cluster_key = 'mapClustering:%s:%i' % (clustering_name, view['detail'])
    rs = sdbutils.select_all(data_dom, sdb_query, [cluster_key], needs_non_null=[cluster_key])
    return count_by(rs, lambda e: e[cluster_key])
  elif type == 'countbyyear':
    rs = sdbutils.select_all(data_dom, sdb_query, ['year'], needs_non_null=['year'])
    return count_by(rs, lambda e: e['year'])
  else:
    raise ValueError("unknown view type \"%s\"" % (type))

def do_cache(query, view):
  return len(query['constraints']) == 0 \
    and (int(view['page'] if 'page' in view else 0) < num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

def handle_query(query, data_dom, clustering_name, query_str=None):
  """
  Produces a JSON (as python objects) response for a query given as a JSON (as
  python objects) query.
  query: The query as JSON (as python objects).
  data_dom: The SimpleDB domain for the data.
  clustering_name: The name of the clustering to use for cluster constraints and
    views.
  query_str: A canonical (ie will be consistent between different requests for
    the same view) string for the whole query; if not given then one will be
    generated as needed.
  """

  def handle_constraint(cnstr_id, cnstr):
    print >> sys.stderr, "handling constraint \"%s\" of type \"%s\"" % (cnstr_id, cnstr['type'])
    return constraint_to_sdb_query(cnstr, clustering_name)
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
        view_response = generate_view(view, sdb_query, data_dom, clustering_name)
        response_cache[cache_key] = view_response
      else:
        print >> sys.stderr, "using cache"
      response[view_id] = view_response
    else:
      print >> sys.stderr, "generating view"
      response[view_id] = generate_view(view, sdb_query, data_dom, clustering_name)
  return response
