"""
Utilities for dates.
"""

def year_key(year, min_year, year_key_digits):
  """
  Format a year integer (negative for BCE) in such a way that lexicographical
  sorting will act like numeric sorting.
  """
  return ("%%0%id" % (year_key_digits)) % (year - min_year)
