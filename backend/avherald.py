"""
Extracting data to index from Json data for The Aviation Herald.
"""

import sys
import datetime
import re
import cgi

facet_field_names = ['locationText', 'currentCountryText', 'personText', 'categoryText']

base_wikipedia_url = "https://en.wikipedia.org"
ref_re = re.compile("\[[0-9]+\]")

def make_html_description(event):
  """
  Expand a description to HTML with suitable markup.
  """

  replacements = list(event['wiki_info'].iteritems()) if 'wiki_info' in event else []
  replacements.sort(key=lambda i: i[1]['span'][0])

  text = event['description']

  # Work out which replacement is the first of the list of references
  first_refs_id = -1
  last_end_index = 0
  for item_id, (item_text, item_info) in enumerate(replacements):
    i, j = item_info['span']
    last_span = text[last_end_index:i]
    if text[last_end_index:i].strip() != "":
      first_refs_id = -1
    if item_text.startswith("http://flightaware.com"):
      if first_refs_id < 0:
        first_refs_id = item_id
    else:
      first_refs_id = -1
    last_end_index = j

  def cleanup(text):
    return cgi.escape(ref_re.sub("", text))

  # Do all the link span replacement while cleaning up everything outside the span
  last_end_index = 0
  index_offset = 0
  for item_id, (item_text, item_info) in enumerate(replacements):
    i, j = item_info['span']
    if i < last_end_index:
      print >> sys.stderr, "warning: span %i:%i \"%s\" overlaps previous span, not making a link" % (i, j, item_text)
      continue
    if 'url' in item_info:
      url = item_info['url']
      if not url.startswith("http://"):
        url = "%s%s" % (base_wikipedia_url, url)
      if item_text == url:
        item_text = "<span class=\"icon-globe\"></span>"
      link = "<a href=\"%s\">%s</a>" % (url, item_text)
      if first_refs_id >= 0 and item_id >= first_refs_id:
        link = "<li>%s</li>" % (link)
        if item_id == first_refs_id:
          link = "<ul class=\"eventrefs\">%s" % (link)
        if item_id == len(replacements) - 1:
          link = "%s</ul>" % (link)
      old_len = len(text)
      text = text[:last_end_index+index_offset] + cleanup(text[last_end_index+index_offset:i+index_offset]) + link + text[j+index_offset:]
      last_end_index = j
      index_offset += len(text) - old_len
  text = text[:last_end_index+index_offset] + cleanup(text[last_end_index+index_offset:])

  # Add in the title
  text = "<a class=\"eventtitle\" href=\"%s\">%s</a> %s" % (event['url'], event['title'], text)

  return text

def get_points(event):
  """
  Get all geographical points for an event.
  """

  def points_from(items):
    return set((float(i['longitude']), float(i['latitude'])) for i in items.itervalues() if 'latitude' in i and 'longitude' in i)
  points = set()
  if 'wiki_info' in event:
    points |= points_from(event['wiki_info'])
  if 'locations' in event:
    points |= points_from(event['locations'])
  return points

def get_required_field_values(num_role_arguments):
  """
  Get values for the required field values. Parameterized on the number of role arguments.
  """

  def get(event):
    points = get_points(event)
    values = {
      'year': int(event['year']),
      'eventRoot': event['eventRoot'],
      'description': event['description'],
      'descriptionHtml': make_html_description(event),
      'allPoints': ["%f,%f" % p for p in points]
    }
    all_roles = []
    for role_id in range(num_role_arguments):
      key = 'roleA%i' % (role_id)
      if key in event:
        values['roleA%i' % (role_id)] = event[key]
        all_roles.append(event[key])
    values['role'] = all_roles
    return values

  return get

def get_facet_field_values(event):
  """
  Get values for the extra keyword field values.
  """

  locationLocationText = set(v['title'] for v in event['locations'].itervalues()) if 'locations' in event else set()
  wikiInfoLocationText = set(v['title'] for v in event['wiki_info'].itervalues() if 'latitude' in v and 'longitude' in v) if 'wiki_info' in event else set()
  values = {
    'locationText': locationLocationText | wikiInfoLocationText,
    'currentCountryText': [v['country'] for (k, v) in event['locations'].iteritems() if 'country' in v] if 'locations' in event else [],
    'personText': [v['title'] for v in event['person'].itervalues()] if 'person' in event else [],
    'categoryText': [c for v in (event['wiki_info'].itervalues() if 'wiki_info' else []) if 'category' in v for c in v['category']]
  }
  return values
