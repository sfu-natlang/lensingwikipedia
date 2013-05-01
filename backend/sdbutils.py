"""
Utilities for SimpleDB with Boto, to cover common cases in queries.
"""

import boto
import cache

pagination_cache = cache.FIFO(100)

def _select_paginated(dom, pattern, order, fields, last_page_cb, page_size, page_num):
  # Here we use the counting trick suggested by
  # https://forums.aws.amazon.com/message.jspa?messageID=253237#253237 to skip
  # ahead to the right point, but we also keep a cache of next pointers to try
  # to resume previous queries directly when possible.

  # First we skip to the start of the page
  pos = page_num * page_size
  next_token = pagination_cache.get((pattern, fields, page_size, pos))
  if next_token is None:
    # Use the counting trick to skip ahead if we don't already have a next pointer for the position
    num_skipped = 0
    next_token = None
    while num_skipped < pos:
      skip_now = pos
      rs = dom.select("select count(*) from `%s` %s %s limit %i" % (dom.name, pattern, order, skip_now), next_token=next_token, max_items=skip_now)
      for i, item in enumerate(rs):
        # I'm not sure why we can't break on the first item, but this seems to be how it works
        if i > 0:
          break
        num_skipped += int(item['Count'])
      next_token = rs.next_token
      if next_token == None:
        # If we got to the end of the possible results then stop
        if last_page_cb is not None:
          last_page_cb()
        return

  # Now we can do the real query, starting from the next token
  rs = dom.select("select %s from `%s` %s %s limit %i" % (fields, dom.name, pattern, order, page_size), next_token=next_token, max_items=page_size)
  for item in rs:
    yield item
    pos += 1
  next_token = rs.next_token

  if next_token is not None:
    pagination_cache[pattern, fields, page_size, pos] = next_token
  elif last_page_cb is not None:
    last_page_cb()

def _select_all(dom, pattern, order, fields):
  query = "select %s from `%s` %s %s" % (fields, dom.name, pattern, order)
  next_token = None
  while True:
    rs = dom.select(query)
    for item in rs:
      yield item
    next_token = rs.next_token
    if next_token == None:
      return

def select_all(dom, pattern=None, fields=['*'], needs_non_null=[], non_null_is_any=False, paginated=None, last_page_callback=None, order=None, order_descending=False):
  """
  Select with commonly used options. Should guarantee finding all matches even
  if there are more than SimpleDB will return at once. Can optionally do
  pagination of results.

  dom: SimpleDB domain to use.
  pattern: A SimpleDB select pattern to use in the query. Shouldn't include the
    "where", just conditions to go after it.
  fields: Fields to return, as a list.
  needs_non_null: Fields that are required to be non-null to match an item.
  non_null_is_any: If set then needs_non_null is interpreted to indicate than
    any of the given fields can be non-null. Otherwise all of the given fields
    must be non-null.
  paginated: Enables pagination and sets the page size and page number to fetch
    (given as a pair).
  """

  where = []
  if pattern is not None and len(pattern.strip()) > 0:
    where.append("%s" % (pattern))
  if len(needs_non_null) > 0:
    sep = " or " if non_null_is_any else " and "
    where.append(sep.join("`%s` is not null" % (f) for f in needs_non_null))

  pattern_str = "where %s" % (" and ".join("(%s)" % (c) for c in where)) if len(where) > 0 else ""
  order_str = "order by %s%s" % (order, " desc" if order_descending else "") if order is not None else ""
  fields_str = ",".join("`%s`" % (f) for f in fields)

  if paginated is None:
    return _select_all(dom, pattern_str, order_str, fields_str)
  else:
    return _select_paginated(dom, pattern_str, order_str, fields_str, last_page_callback, *paginated)

def get_domain(sdb, dom_name, make_new=True, delete_old=False):
  """
  Gets a domain.
  make_new: Create the domain if it doesn't already exist.
  delete_old: Remove any old domain with the same name.
  """
  if delete_old:
    try:
      sdb.delete_domain(dom_name)
    except boto.exception.SDBResponseError:
      pass
  try:
    return sdb.get_domain(dom_name)
  except boto.exception.SDBResponseError:
    if make_new:
      return sdb.create_domain(dom_name)
    else:
      raise

def remove_all_attributes(dom, attributes):
  """
  Removes all uses of given attributes from a domain.
  """
  for item in select_all(dom, needs_non_null=attributes, non_null_is_any=True):
    dom.delete_attributes(item.name, attributes)
