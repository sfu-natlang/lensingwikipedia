def year_key(year, min_year, year_key_digits):
  return ("%%0%id" % (year_key_digits)) % (year - min_year)
