"""
Query (frontend to backend) handling.

Note: There are two kinds of pagination we can do for results. Query pagination
lets the database deal with pagination for us, with the backend only having to
cache next pointers. Result pagination is done on the backend, with the database
returning complete unpaginated results and the backend clipping them to get the
desired page (with some caching to be less wasteful). The later is used for
cases (counting by values) where we have to process the results from the
database in such a way that it can't do pagination for us.
"""

import sys
import collections
import hashlib
import json
import dates
import traceback
import sdbutils
import caching

class QueryHandlingError(Exception):
  """
  Exception for errors in query handling that should send an error message to
  the frontend.
  """
  def __init__(self, value):
    self.value = value

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
  assert False

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
    # All possible predicate argument numbers
    settings.setdefault('all_argument_numbers', [0, 1])
    # Number of events on a page of descriptions
    settings.setdefault('description_page_size', 25)
    # Number of events on a page of count by field value results
    settings.setdefault('count_by_field_value_page_size', 50)
    # Number of events on a page of count by year results
    settings.setdefault('count_by_year_page_size', 50)
    # Number of events on a page of count by reference point results
    settings.setdefault('count_by_referencepoint_page_size', 50)
    # Number of pages of the initial (empty conditional) query to cache
    settings.setdefault('num_initial_description_pages_to_cache', 10)
    # Size of the cache for query pagination (next pointers for results the DB can paginate)
    settings.setdefault('query_pagination_cache_size', 100)
    # Size of the cache for result pagination (cached results for pagination done on the backend)
    settings.setdefault('result_pagination_cache_size', 100)
    # Minimum possible year
    settings.setdefault('min_year', None)
    # Number of digits in a year key (for sorting)
    settings.setdefault('year_key_digits', None)
    # Names of fields to prime the cache with
    settings.setdefault('fields_to_prime', [])
    # Maximum number of events to count over before giving up
    settings.setdefault('max_items_to_count_over', 1000)

    for key, value in settings.iteritems():
      setattr(self, key, value)

    self.response_cache = caching.Complete()
    self.description_paginator = sdbutils.QueryPaginator(default_page_size=self.description_page_size)
    self.description_paginator.cache.set_max_size(self.query_pagination_cache_size)
    self.results_pagination_cache = caching.FIFO(self.result_pagination_cache_size)

    if self.min_year is None or self.year_key_digits is None:
      min_year, year_key_digits = discover_year_range(self.data_dom)
      if self.min_year is None:
        self.min_year = min_year
      if self.year_key_digits is None:
        self.year_key_digits = year_key_digits

  def queries_to_prime(self):
    """
    Generator for all queries to prime caches with.
    """
    def views_for_initial():
      for field in self.fields_to_prime:
        yield { 'type': 'countbyfieldvalue', 'field': field }
      yield { 'type': 'countbyyear' }
      yield { 'type': 'countbyreferencepoint' }
      yield { 'type': 'descriptions' }
      for page_num in range(self.num_initial_description_pages_to_cache):
        yield { 'type': 'descriptions', 'page': page_num }
    yield { 'constraints': {}, 'views': dict((i, v) for i, v in enumerate(views_for_initial())) }

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
    elif type == 'referencepoints':
      # SimpleDB only allows up to 20 comparisons on a single attribute (see https://forums.aws.amazon.com/thread.jspa?threadID=40439; I'm not sure where this is in the official documentation). However, using this dummy field hack gets around that for some reason. See http://blog.yslin.tw/2012/03/simpledb-too-many-value-tests-per.html. Here we do the hack by splitting the values into smaller groups and interspersing "in" conditions on these groups with "is not null" conditions on a dummy field. However, this only works up to the point where we hit the predicate limit (also around 20).
      def split_list(list, part_size):
        i = 0
        while i < len(list):
          j = i + part_size
          yield list[i:j]
          i = j
      points = split_list(cnstr['points'], 20)
      return "(%s)" % (" or `_dummy_` is not null or ".join("`referencepoints` in (%s)" % (",".join("'%s'" % (p) for p in points_part)) for points_part in points))
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

    for i, item in enumerate(sdbutils.select_all(self.data_dom, sdb_query, field_keys, needs_non_null=field_keys, non_null_is_any=True)):
      if self.max_items_to_count_over is not None and i > self.max_items_to_count_over:
        raise QueryHandlingError("too many matching events, narrow the query more")
      for view_id, view in views.iteritems():
        counts = response[view_id]['counts']
        values = set(v for f in view['_use_fields'] if f in item for v in (item[f] if isinstance(item[f], list) else [item[f]]))
        for value in values:
          counts.setdefault(value, 0)
          counts[value] += 1

    for view_id, view in views.iteritems():
      counts = response[view_id]['counts'].items()
      counts.sort(key=lambda (v, c): c, reverse=True)
      response[view_id]['counts'] = counts

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
      rs = sdbutils.select_all(self.data_dom, sdb_query, ['year', 'descriptionHtml', 'eventRoot'], paginated=(self.description_paginator, page_num), last_page_callback=on_last_page, needs_non_null=['yearKey'], order='yearKey', order_descending=True)
      def format(item):
        event = dict(item)
        event['dbid'] = item.name
        return event
      result['descriptions'] = [format(e) for e in rs]
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

    # We defer all the count by field value views until the end so we can do them all on a single DB query. We also rewrite some other queries in terms of field value views (these get separate query types since they might need special handling later).
    field_count_views = {}

    for view_id, view in views.iteritems():
      type = view['type']
      if type == 'countbyfieldvalue':
        field_count_views[view_id] = view
      elif type == 'countbyreferencepoint':
        field_count_views[view_id] = {
          'type': 'countbyfieldvalue',
          'field': 'referencepoints'
        }
      elif type == 'countbyyear':
        field_count_views[view_id] = {
          'type': 'countbyfieldvalue',
          'field': 'year'
        }
      else:
        try:
          response[view_id] = self.handle_independent_view(view, sdb_query)
        except Exception, e:
          response[view_id] = { 'error': e.value if isinstance(e, QueryHandlingError) else True }
          print >> sys.stderr, "error while generating a view:"
          traceback.print_exc(file=sys.stderr)

    if len(field_count_views) > 0:
      try:
        self.generate_field_counts(response, field_count_views, sdb_query)
      except Exception, e:
        message = e.value if isinstance(e, QueryHandlingError) else True
        for view_id in field_count_views:
          response[view_id] = { 'error': message }
        print >> sys.stderr, "error while generating count views:"
        traceback.print_exc(file=sys.stderr)

    return response

  def should_cache(self, query, view):
    """
    Predicate determining which views to cache.
    query: The whole query being processed.
    views: The particular view to consider caching.
    """
    return len(query['constraints']) == 0 \
      and (int(view['page'] if 'page' in view else 0) < self.num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

  def how_to_paginate_results(self, query, view):
    """
    Function determining which views to paginate the results from at the
    backend. Views which can be paginated by the DB should do that instead (in
    their view handling code) since that is more efficient. Returns a (attribute
    name, page size) pair if the view should be paginated. Otherwise returns
    None.
    query: The whole query being processed.
    views: The particular view to consider caching.
    """
    type = view['type']
    if type == 'countbyfieldvalue' :
      return ('counts', self.count_by_field_value_page_size)
    elif type == 'countbyyear':
      # This view is paginated only if it requests it by setting the 'page' attribute.
      if 'page' in view:
        return ('counts', self.count_by_year_page_size)
    elif type == 'countbyreferencepoint':
      # This view is paginated only if it requests it by setting the 'page' attribute.
      if 'page' in view:
        return ('counts', self.count_by_referencepoint_page_size)
    return None

  def prime(self):
    """
    Primes the querier by self-submitting queries that will get cached.
    """
    # Disable maximum items to count over temporarily.
    old_mitco = self.max_items_to_count_over
    self.max_items_to_count_over = None
    for query in self.queries_to_prime():
      self.handle(query)
    self.max_items_to_count_over = old_mitco

  def handle_all_constraints(self, query):
    # Generate the SimpleDB query string for the constraints.
    def handle_constraint(cnstr_id, cnstr):
      print >> sys.stderr, "handling constraint \"%s\" of type \"%s\"" % (cnstr_id, cnstr['type'])
      return self.constraint_to_sdb_query(cnstr)
    return " and ".join("(%s)" % (handle_constraint(cid, c)) for cid, c in query['constraints'].iteritems())

  def handle_all_views(self, query, sdb_query):
    # This is inefficient but works to generate cache keys. For each view we will use an SHA keys across the stringified JSON for all the constraints and that view.
    cnstrs_shaer = hashlib.sha1()
    for cnstr in query['constraints'].iteritems():
      cnstrs_shaer.update(json.dumps(cnstr))

    response = {}
    needed_views = {}
    for view_id, view in query['views'].iteritems():
      view_response = None
      should_cache = self.should_cache(query, view)
      how_to_paginate_result = self.how_to_paginate_results(query, view)

      if should_cache or how_to_paginate_result is not None:
        # If we are doing either full caching or result pagination, then prepare a cache key.
        if how_to_paginate_result is not None:
          # For a result paginated view we don't want the page number as part of the cache key since we want to cache the whole result before pagination (for a query that can be paginated by the DB then we need the page number since we store a separate result for each page).
          if 'page' in view:
            page_num = view['page']
            del view['page']
          else:
            page_num = 0
        shaer = cnstrs_shaer.copy()
        shaer.update(json.dumps(view))
        cache_key = shaer.digest()
        view['_cache_key'] = cache_key

        # If caching the whole result, then use the cached copy if available and otherwise flag the view for later caching.
        if should_cache:
          view_response = self.response_cache.get(cache_key)
          if view_response is not None:
            method_str = "using cache"
            response[view_id] = view_response
          else:
            view['_should_cache'] = True

        # If we are doing result pagination, keep the needed information. Also try to use the result pagination cache if we didn't already get a result from the main cache.
        if how_to_paginate_result is not None:
          view['_how_to_paginate_result'] = how_to_paginate_result
          view['_page_num'] = page_num
          if view_response is None:
            view_response = self.results_pagination_cache.get(cache_key)
            if view_response is not None:
              method_str = "using result pagination cache"
              response[view_id] = view_response

      if view_response is None:
        method_str = "generating view"
        needed_views[view_id] = view

      print >> sys.stderr, "handling view \"%s\" of type \"%s\": %s" % (view_id, view['type'], method_str)

    # Get results for all views that were not cached.
    self.generate_views(response, needed_views, sdb_query)

    for view_id, view in query['views'].iteritems():
      if '_cache_key' in view:
        result = response[view_id]
        how_to_paginate_result = view.get('_how_to_paginate_result')
        # Update the caches.
        if view.get('_should_cache'):
          self.response_cache[view['_cache_key']] = result
        elif how_to_paginate_result is not None:
          self.results_pagination_cache[view['_cache_key']] = result
        # Handle result pagination.
        if how_to_paginate_result is not None:
          paginate_attr, page_size = how_to_paginate_result
          page_num = view['_page_num']
          paginated_result = {}
          for attr, value in result.iteritems():
            if attr != paginate_attr:
              paginated_result[attr] = value
          if paginate_attr in result:
            i = page_num * page_size
            j = i + page_size
            paginated_result[paginate_attr] = result[paginate_attr][i:j]
            paginated_result['more'] = j < len(result[paginate_attr])
            response[view_id] = paginated_result

    return response

  def handle(self, query):
    """
    Produces a JSON (as python objects) response for a query given as a JSON (as
    python objects) query.
    query: The query as JSON (as python objects).
    """
    try:
      sdb_query = self.handle_all_constraints(query)
      response = self.handle_all_views(query, sdb_query)
    except Exception, e:
      message = e.value if isinstance(e, QueryHandlingError) else True
      response = {}
      for view_id in query['views']:
        response[view_id] = { 'error': message }
      print >> sys.stderr, "error while handling query:"
      traceback.print_exc(file=sys.stderr)
    return response
