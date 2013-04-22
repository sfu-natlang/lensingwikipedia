"""
Utilities for IO.
"""

import tempfile
import os

class cache_input:
  """
  Stores input from a file object into a temp file.
  """

  def __init__(self, input):
    self.input = input
    self.tmp_path = None

  def __enter__(self):
    cache_fd, tmp_path = tempfile.mkstemp()
    cache_output = os.fdopen(cache_fd, 'w')
    for line in self.input:
      cache_output.write(line)
    cache_output.close()
    self.tmp_path = tmp_path
    return tmp_path

  def __exit__(self, type, value, traceback):
    os.remove(self.tmp_path)
