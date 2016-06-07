import queries

def read_settings_from_file(path):
  """
  Reads in settings from a text file.
  """
  def check_settings(settings, defaults):
    for setting, value in settings.iteritems():
      if setting not in defaults:
        raise queries.UnknownSetting(setting)
      def_value = defaults[setting]
      if hasattr(def_value, 'iteritems'):
        check_settings(value, def_value)
  with open(path) as input_file:
    settings = eval(input_file.read())
    check_settings(settings, backend_settings_defaults.settings)
    return settings

