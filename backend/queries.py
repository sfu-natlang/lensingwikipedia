"""
Query (frontend to backend) handling.
"""

import sys
import traceback
import whoosh, whoosh.query, whoosh.sorting
import whooshutils
import hashlib
import time
import json
import caching
import backend_settings, backend_settings_defaults, backend_domain_settings_defaults

# Use the domain config file.
import backend_domain_config

class QueryHandlingError(Exception):
  """
  Exception for errors in query handling that should send an error message to
  the frontend.
  """
  def __init__(self, value):
    self.value = value

class Querier:
  """
  Query handler. Should be able to operate independently of any other query handler.
  """

  def __init__(self, whoosh_index, **our_settings):
    """
    Make new querier. All arguments are keyword arguments. See the comments in
    the method body for more information.
    """

    self.whoosh_index = whoosh_index
    backend_settings.apply(self, our_settings, backend_settings_defaults.settings['querier'], backend_domain_settings_defaults.settings['querier'])

    self.results_pagination_cache = caching.FIFO(self.result_pagination_cache_size)
    self.response_cache = caching.Complete()

    self.query_parser = whooshutils.TextQueryParser(schema=whoosh_index.schema, field_map=backend_domain_config.field_name_aliases)

  def should_cache(self, query, view):
    """
    Predicate determining which views to cache results for.
    query: The whole query being processed.
    views: The particular view to consider caching.
    """
    return len(query['constraints']) == 0 \
      and (int(view['page'] if 'page' in view else 0) < self.num_initial_description_pages_to_cache if view['type'] == "descriptions" else True)

  def queries_to_prime(self):
    """
    Generator for all queries to prime caches with.
    """
    def views_for_initial():
      for field in self.fields_to_prime:
        yield { 'type': 'countbyfieldvalue', 'field': field }
      yield { 'type': 'countbyyear' }
      yield { 'type': 'countbyreferencepoint' }
      yield { 'type': 'referencepointlinks' }
      yield { 'type': 'descriptions' }
      yield { 'type': 'tsnecoordinates' }
      for page_num in range(self.num_initial_description_pages_to_cache):
        yield { 'type': 'descriptions', 'page': page_num }
    yield { 'constraints': {}, 'views': dict((i, v) for i, v in enumerate(views_for_initial())) }

  def how_to_paginate_results(self, query, view):
    """
    Function determining which views to paginate the results from at the
    backend. Views which can be paginated by Whoosh should do that instead (in
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
      if 'page' in view:
        return ('counts', self.count_by_year_page_size)
    elif type == 'countbyreferencepoint':
      if 'page' in view:
        return ('counts', self.count_by_referencepoint_page_size)
    elif type == 'referencepointlinks':
      if 'page' in view:
        return ('links', self.referencepointlinks_page_size)
    return None

  def constraint_to_whoosh_query(self, cnstr):
    """
    Produces a Whoosh query (using the python object format, not the text
    format) representing a single constraint.
    cnstr: The constraint as JSON (as python objects).
    """

    type = cnstr['type']
    if type == 'fieldvalue':
      field = cnstr['field']
      field = backend_domain_config.field_name_aliases(field) or field
      return whoosh.query.Term(field, whooshutils.escape_keyword(cnstr['value']))
    if type == 'textsearch':
      return self.query_parser.parse(cnstr['value'])
    elif type == "timerange":
      low, high = cnstr['low'], cnstr['high']
      return whoosh.query.NumericRange('year', low, high)
    elif type == 'referencepoints':
      return whoosh.query.Or([whoosh.query.Term('referencePoints', whooshutils.escape_keyword(p)) for p in cnstr['points']])
    else:
      raise ValueError("unknown constraint type \"%s\"" % (type))

  def handle_all_constraints(self, query):
    """
    Generate the Whoosh query object for the constraints.
    """
    def handle_constraint(cnstr_id, cnstr):
      print >> sys.stderr, "handling constraint \"%s\" of type \"%s\"" % (cnstr_id, cnstr['type'])
      return self.constraint_to_whoosh_query(cnstr)
    return whoosh.query.And([handle_constraint(cid, c) for cid, c in query['constraints'].iteritems()]) if len (query['constraints']) > 0 else whoosh.query.Every()

  def generate_field_counts(self, response, views, whoosh_query):
    """
    Handles all the count by field value views for a query. All values of a
    multiple-valued field are counted.
    """

    print >> sys.stderr, "generating field counts for fields: %s" % (' '.join(v['field'] for v in views.itervalues()))

    for view_id, view in views.iteritems():
      response[view_id] = { 'counts': {} }

    with self.whoosh_index.searcher() as searcher:
      hits = searcher.search(whoosh_query, limit=None)
      print >> sys.stderr, "whoosh search results: %s" % (repr(hits))
      for hit in hits:
        for view_id, view in views.iteritems():
          field = view['field']
          field = backend_domain_config.field_name_aliases(field) or field
          if field in hit:
            values = set(v for v in whooshutils.split_keywords(hit[field]))
            counts = response[view_id]['counts']
            for value in values:
              counts.setdefault(value, 0)
              counts[value] += 1

    for view_id, view in views.iteritems():
      counts = response[view_id]['counts'].items()
      counts.sort(key=lambda (v, c): c, reverse=True)
      response[view_id]['counts'] = counts

  def _handle_descriptions_view(self, view, whoosh_query):
    page_num = view['page'] if 'page' in view else 0
    result = { 'more': True }

    with self.whoosh_index.searcher() as searcher:
      def format(hit):
        return dict((f, hit[f]) for f in backend_domain_config.description_field_names)
      hits = searcher.search_page(whoosh_query, page_num + 1, pagelen=self.description_page_size, sortedby='year', reverse=True)
      print >> sys.stderr, "whoosh pre-paginated search results: %s" % (repr(hits.results))
      result['descriptions'] = [format(h) for h in hits]
      if hits.is_last_page():
        result['more'] = False
    return result

  def _handle_referencepointlinks_view(self, view, whoosh_query):
    link_counts = {}
    with self.whoosh_index.searcher() as searcher:
      hits = searcher.search(whoosh_query, limit=None)
      print >> sys.stderr, "whoosh search results: %s" % (repr(hits))
      for hit in hits:
        refpoints = whooshutils.split_keywords(hit['referencePoints'])
        for i, refpoint1 in enumerate(refpoints):
          for refpoint2 in refpoints[i+1:]:
            if refpoint1 != refpoint2:
              # Use lexicographic order to guarantee unique choices of two distinct reference points
              pair = (refpoint1, refpoint2) if refpoint1 < refpoint2 else (refpoint2, refpoint1)
              link_counts.setdefault(pair, 0)
              link_counts[pair] += 1
    return {
      'links': [{ 'refpoints': p, 'count': c } for (p, c) in link_counts.iteritems()]
    }
  
  def _handle_tsnecoordinates_view(self, view, whoosh_query):
    print >> sys.stderr, whoosh_query
    coordinates = {}
    with self.whoosh_index.searcher() as searcher:
      hits = searcher.search(whoosh_query, limit=None)
      print >> sys.stderr, "whoosh search results: %s" % (repr(hits))
      for hit in hits:
        if '2DtSNECoordinates' in hit:
          refpoints = whooshutils.split_keywords(hit['2DtSNECoordinates'])
          id = hit['id']
          sentence = hit['sentence']
          for refpoint in refpoints:
            if refpoint:
              coordinate_splits = whooshutils.split_keywords(refpoint)
              coordinates[id] = {'x': coordinate_splits[0], 'y': coordinate_splits[1], 'text': sentence}
    return {
      'coordinates': [{ 'id': i, 'coordinates': {'x': p['x'], 'y': p['y']}, 'text': p['text'] } for i, p in coordinates.iteritems()]
    }


  def handle_independent_view(self, view, whoosh_query):
    """
    Handles one of the views which is done on its own independent Whoosh query.
    """

    type = view['type']
    if type == 'descriptions':
      return self._handle_descriptions_view(view, whoosh_query)
    elif type == 'referencepointlinks':
      return self._handle_referencepointlinks_view(view, whoosh_query)
    elif type == 'tsnecoordinates':
      return self._handle_tsnecoordinates_view(view, whoosh_query)
    else:
      raise ValueError("unknown view type \"%s\"" % (type))

  def generate_views(self, response, views, whoosh_query):
    """
    Produces the JSON (as python objects) response for the view requests.
    response: Response JSON (as python objects) to put output in.
    views: The views as dictionary of JSON (as python objects) views, keyed by their IDs.
    whoosh_query: The Whoosh query object for the current query.
    """

    # We defer all the count by field value views until the end so we can do them all on a single Whoosh query. We also rewrite some other queries in terms of field value views (these get separate query types since they might need special handling later).
    field_count_views = {}

    for view_id, view in views.iteritems():
      type = view['type']
      if type == 'countbyfieldvalue':
        field_count_views[view_id] = view
      elif type == 'countbyreferencepoint':
        field_count_views[view_id] = {
          'type': 'countbyfieldvalue',
          'field': 'referencePoints'
        }
      elif type == 'countbyyear':
        field_count_views[view_id] = {
          'type': 'countbyfieldvalue',
          'field': 'year'
        }
      else:
        try:
          response[view_id] = self.handle_independent_view(view, whoosh_query)
        except Exception, e:
          response[view_id] = { 'error': e.value if isinstance(e, QueryHandlingError) else True }
          print >> sys.stderr, "error while generating a view:"
          traceback.print_exc(file=sys.stderr)

    if len(field_count_views) > 0:
      try:
        self.generate_field_counts(response, field_count_views, whoosh_query)
      except Exception, e:
        message = e.value if isinstance(e, QueryHandlingError) else True
        for view_id in field_count_views:
          response[view_id] = { 'error': message }
        print >> sys.stderr, "error while generating count views:"
        traceback.print_exc(file=sys.stderr)

    return response

  def handle_all_views(self, query, whoosh_query):
    # This is inefficient but works to generate cache keys. For each view we will use an SHA keys across the stringified JSON for all the constraints and that view.
    cnstrs_shaer = hashlib.sha1()
    for cnstr in query['constraints'].iteritems():
      cnstrs_shaer.update(json.dumps(cnstr))

    response = {}
    needed_views = {}

    views_cache_key = {}
    views_should_cache = {}
    views_page_num = {}
    views_required_keys = {}
    views_how_to_paginate_result = {}

    for view_id, view in query['views'].iteritems():
      view_response = None
      should_cache = self.should_cache(query, view)
      how_to_paginate_result = self.how_to_paginate_results(query, view)

      if should_cache or how_to_paginate_result is not None:
        # If we are doing either full caching or result pagination, then prepare a cache key.
        if how_to_paginate_result is not None:
          # For a result paginated view we don't want the page number or required keys as part of the cache key since we want to cache the whole result before pagination (for a query that can be paginated by Whoosh then we need the page number since we store a separate result for each page).
          if 'page' in view:
            page_num = view['page']
            del view['page']
          else:
            page_num = 0
          if 'requiredkeys' in view:
            required_keys = view['requiredkeys']
            del view['requiredkeys']
          else:
            required_keys = []

        shaer = cnstrs_shaer.copy()
        shaer.update(json.dumps(view))
        cache_key = shaer.digest()
        views_cache_key[view_id] = cache_key

        # If caching the whole result, then use the cached copy if available and otherwise flag the view for later caching.
        if should_cache:
          view_response = self.response_cache.get(cache_key)
          if view_response is not None:
            method_str = "using cache"
            response[view_id] = view_response
          else:
            views_should_cache[view_id] = True

        # If we are doing result pagination, keep the needed information. Also try to use the result pagination cache if we didn't already get a result from the main cache.
        if how_to_paginate_result is not None:
          views_how_to_paginate_result[view_id] = how_to_paginate_result
          views_page_num[view_id] = page_num
          views_required_keys[view_id] = set(required_keys)
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
    self.generate_views(response, needed_views, whoosh_query)

    for view_id, view in query['views'].iteritems():
      if view_id in views_cache_key:
        result = response[view_id]
        how_to_paginate_result = views_how_to_paginate_result.get(view_id)
        # Update the caches.
        if view_id in views_should_cache:
          if 'error' in result:
            print >> sys.stderr, "not caching due to error"
          else:
            self.response_cache[views_cache_key[view_id]] = result
        elif how_to_paginate_result is not None:
          self.results_pagination_cache[views_cache_key[view_id]] = result
        # Handle result pagination.
        if how_to_paginate_result is not None:
          paginate_attr, page_size = how_to_paginate_result
          page_num = views_page_num[view_id]
          paginated_result = {}
          for attr, value in result.iteritems():
            if attr != paginate_attr:
              paginated_result[attr] = value
          if paginate_attr in result:
            i = page_num * page_size
            j = i + page_size
            paginated_result[paginate_attr] = result[paginate_attr][i:j]
            need_to_prepend, need_to_append = [], []
            for k, pair in enumerate(result[paginate_attr]):
              key, value = pair
              if key in views_required_keys[view_id]:
                if k < i:
                  need_to_prepend.append(pair)
                elif k >= j:
                  need_to_append.append(pair)
            paginated_result[paginate_attr] = need_to_prepend + paginated_result[paginate_attr] + need_to_append
            paginated_result['more'] = j < len(result[paginate_attr])
            response[view_id] = paginated_result

    return response

  def prime(self):
    """
    Primes the querier by self-submitting queries that will get cached.
    """
    for query in self.queries_to_prime():
      self.handle(query)

  def handle(self, query):
    """
    Produces a JSON (as python objects) response for a query given as a JSON (as
    python objects) query.
    query: The query as JSON (as python objects).
    """
    start_time = time.time()
    try:
      whoosh_query = self.handle_all_constraints(query)
      if self.verbose:
        print >> sys.stderr, "whoosh query: %s" % (repr(whoosh_query))
      response = self.handle_all_views(query, whoosh_query)
    except Exception, e:
      message = e.value if isinstance(e, QueryHandlingError) else True
      response = {}
      for view_id in query['views']:
        response[view_id] = { 'error': message }
      print >> sys.stderr, "error while handling query:"
      traceback.print_exc(file=sys.stderr)
    if self.verbose:
      done_time = time.time()
      print >> sys.stderr, "query handling time: %0.4f" % (done_time - start_time)
    return response
