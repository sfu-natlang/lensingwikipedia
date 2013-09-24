"""
Utilities for reading and using settings.
"""

import sys
import default_settings

class UnknownSetting(Exception):
  def __init__(self, setting):
    Exception.__init__(self, "unknown setting \"%s\"" % (setting))

class MissingRequiredSetting(Exception):
  def __init__(self, setting):
    Exception.__init__(self, "missing required setting \"%s\"" % (setting))

def read_from_file(path):
  """
  Reads in settings from a text file.
  """
  def check_settings(settings, defaults):
    for setting, value in settings.iteritems():
      if setting not in defaults:
        raise UnknownSetting(setting)
      def_value = defaults[setting]
      if hasattr(def_value, 'iteritems'):
        check_settings(value, def_value)
  with open(path) as input_file:
    settings = eval(input_file.read())
    check_settings(settings, default_settings.settings)
    return settings

def read_new_from_file(path, old_settings, old_settings_name="previous"):
  """
  Try to read new settings from a file, falling back on old settings if there is
  any problem parsing the new.
  """
  try:
    return read_from_file(path)
  except Exception, e:
    print >> sys.stderr, "error parsing new settings, retaining %s settings instead: %s" % (old_settings_name, str(e))
    return old_settings

def apply(dest, settings, defaults):
  """
  Apply settings as properties of an object, falling back on defaults as needed.
  """
  for setting, value in defaults.iteritems():
    if setting not in settings:
      setattr(dest, setting, value)
  for setting, value in settings.iteritems():
    if setting in defaults:
      setattr(dest, setting, value)
    else:
      raise UnknownSetting(setting)

"""
Make a class to expand settings to an object with given defaults filled in.
"""
def make_settings_structure(defaults):
  class SettingsStructure:
    def __init__(self, **settings):
      apply(self, settings, defaults)
  return SettingsStructure
