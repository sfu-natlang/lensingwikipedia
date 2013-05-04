"""
Settings stuff for the backend, including defaults and utilities for accessing
settings.
"""

import boto
import sys

class Settings:
  def __init__(self, other=None):
    if other is not None:
      for setting, value in other.__dict__.iteritems():
        setattr(self, setting, value)

# Default settings for the backend
defaults = Settings()
defaults.settings_timeout = 60 * 60
defaults.data_domain_name = None
defaults.cluster_domain_name = None
defaults.clustering_name = 'default'
defaults.description_page_size = 25
defaults.num_initial_description_pages_to_cache = 10
defaults.pagination_cache_size = 100
defaults.all_argument_numbers = [0, 1]

# How to parse the settings
parse_settings = {
  'settings_timeout': int,
  'data_domain_name': str,
  'cluster_domain_name': str,
  'clustering_name': str,
  'num_initial_description_pages_to_cache': int,
  'description_page_size': int,
  'pagination_cache_size': int,
  'all_argument_numbers': lambda s: s.split(',')
}
parse_from_db = {
  'all_argument_numbers': lambda i: [int(an) for an in i]
}

def update_settings_from_db(settings, default_settings, settings_dom):
  def update(setting):
    old_value = getattr(settings, setting)
    try:
      parser = parse_from_db.get(setting) or parse_settings[setting]
      new_value = parser(settings_dom.get_item(setting)['value'])
    except:
      new_value = None
    if new_value == old_value:
      print >> sys.stderr, "setting %s: no change %s" % (setting, repr(old_value))
    elif new_value is None:
      def_value = getattr(default_settings, setting)
      print >> sys.stderr, "setting %s: using default %s" % (setting, repr(def_value))
      setattr(settings, setting, def_value)
    else:
      print >> sys.stderr, "setting %s: new value %s" % (setting, repr(new_value))
      setattr(settings, setting, new_value)

  for setting in settings.__dict__:
    update(setting)

def update_db_from_settings(settings_dom, settings):
  for setting, value in settings.__dict__.iteritems():
    if value is not None:
      print "%s -> %s" % (setting, str(value))
      settings_dom.put_attributes(setting, { 'value': value })
    else:
      print "%s -> " % (setting)
      item = settings_dom.get_item(setting)
      if item is not None:
        settings_dom.delete_item(item)

def update_settings_from_file(settings, input):
  """
  Reads in settings from a text file. Can be called on a file containing the
  result from show_from_db() or show_from_settings().
  """
  for line in input:
    i = line.index(':')
    setting = line[:i-1]
    value = line[i+2:].strip()
    if value.strip() == "":
      value = None
    else:
      value = parse_settings[setting](value)
    setattr(settings, setting, value)

def show_from_db(settings_dom, show_all=False):
  for setting in parse_settings:
    item = settings_dom.get_item(setting)
    if item is not None or show_all:
      print "%s : %s" % (setting, str(item['value']) if item is not None else '')

def show_from_settings(settings_dom):
  for setting, value in settings.__dict__.iteritems():
    print "%s : %s" % (setting, value if value is not None else '')
