"""
Cache structures.
"""

import sys
import heapq

class Complete:
  """
  Cache which keeps everything.
  """

  def __init__(self):
    self.lookup = {}

  def clear(self):
    self.lookup = {}

  def __getitem__(self, key):
    return self.lookup[key]

  def get(self, key):
    return self.lookup.get(key)

  def __setitem__(self, key, value):
    self.lookup[key] = value

  def __len__(self):
    return len(self.lookup)

  def __contains__(self, key):
    return key in self.lookup

class FIFO:
  """
  Cache which keeps the last n items chronologically.
  """

  max_id = sys.maxint
  min_id = -sys.maxint - 1

  def __init__(self, max_size):
    self.max_size = max_size
    self.clear()

  def set_max_size(self, max_size):
    self.max_size = max_size
    while len(self.queue) > max_size:
      del_id, del_key = heapq.heappop(self.queue)
      del self.lookup[del_key]

  def clear(self):
    self.next_id = self.min_id
    self.lookup = {}
    self.queue = []

  def __getitem__(self, key):
    return self.lookup[key]

  def get(self, key):
    return self.lookup.get(key)

  def __setitem__(self, key, value):
    id = self.next_id
    if id == self.max_id:
      self.clear()
      id = self.next_id
    self.next_id += 1
    if key in self.lookup:
      i = -1
      while i < len(self.queue):
        if self.queue[i][1] == key:
          break
        i += 1
      self.queue[i] = (id, key)
      heapq.heapify(self.queue)
      self.lookup[key] = value
    else:
      if len(self.queue) < self.max_size:
        heapq.heappush(self.queue, (id, key))
      else:
        old_id, old_key = heapq.heapreplace(self.queue, (id, key))
        del self.lookup[old_key]
    self.lookup[key] = value

  def __len__(self):
    return len(self.queue)

  def __contains__(self, key):
    return key in self.lookup
