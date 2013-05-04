"""
Point clustering.
"""

import sys

class Cluster:
  def __init__(self, id):
    self.id = id
    self.init_centre = [0.0, 0.0]
    self.init_count = 0
    self.centre = [0.0, 0.0]
    self.count = 0
    self.events = set()

def geo_cluster(iter_events, thresholds, add_event_to_cluster, set_cluster_info):
  """
  Geographic clustering of points.

  This is implemented to keep as little as possible in memory and minimize
  passes over the data. Events and detail_levels are given by IDs which need to
  be hashable but are otherwise arbitrary. Similarly cluster IDs are preduced to
  represent clusters.

  iter_events: Function which takes no arguments and iterates over events, for
    each event yielding an arbitrary object representing the event, and a
    longitude-latitude coordinate for it.
  thresholds: Thresholds for distance to cluster centre used to decide when to
    add a point to an existing cluster versus creating a new cluster. Given as a
    dictionary where the keys are IDs for the desired detail levels and values
    are the corresponding threshold values.
  add_event_to_cluster: Function which takes an event object (from
    iter_events()), a detail level ID, and a cluster number and assigns the
    event to the cluster at the specified detail level.
  set_cluster_info: Function which takes a detail level ID, a cluster ID, and a
    longitude-latitude pair and registers this information (presumably stores it
    somewhere).
  """

  from math import atan2, sqrt, sin, cos, pi
  deg_to_rad = pi / 180.0
  def dist(a, b):
    # Vincenty formula, following the d3 implementation.
    dl = (b[0] - a[0]) * deg_to_rad
    p0, p1 = a[1] * deg_to_rad, b[1] * deg_to_rad
    sin_dl, cos_dl = sin(dl), cos(dl)
    sin_p0, cos_p0 = sin(p0), cos(p0)
    sin_p1, cos_p1 = sin(p1), cos(p1)
    return atan2(sqrt((cos_p1 * sin_dl)**2 + (cos_p0 * sin_p1 - sin_p0 * cos_p1 * cos_dl)**2), sin_p0 * sin_p1 + cos_p0 * cos_p1 * cos_dl)
  def updateAvgGeoPoint(avg, sample, count):
    """
    Update a running average of geo points, compensating for the fact that they
    may wrap around the antimeridian.
    """
    if count > 0:
      lon_changes = [0.0, 360.0, -360.0]
      lon = sample[0] + min(lon_changes, key=lambda dl: abs(sample[0] + dl - avg[0]))
      sample = (lon, sample[1])
      for i in range(2):
        avg[i] = (avg[i] * (count - 1) + sample[i]) / count
    else:
      for i in range(2):
        avg[i] = sample[i]
    if avg[0] > 180:
      avg[0] -= 360.0
    elif avg[0] < -1280:
      avg[0] += 360.0

  detail_levels = sorted(thresholds)
  all_clusters = dict((dl, []) for dl in detail_levels)

  # First pass to get cluster centres
  for detail_level in detail_levels:
    clusters = all_clusters[detail_level]
    threshold = thresholds[detail_level]
    for event, points in iter_events():
      for point in points:
        closest = min(clusters, key=lambda c: dist(c.init_centre, point)) if len(clusters) > 0 else None
        if closest is None or dist(closest.init_centre, point) > threshold:
          closest = Cluster(len(clusters))
          clusters.append(closest)
        closest.init_count += 1
        updateAvgGeoPoint(closest.init_centre, point, closest.count)
    print >> sys.stderr, "num clusters at detail level %s: %i" % (str(detail_level), len(clusters))

  # Second pass to assign points to clusters
  # TODO: I'm not sure if this two-pass system is needed, or if the issues I added it to fix were caused by other bugs.
  for detail_level in detail_levels:
    clusters = all_clusters[detail_level]
    for event, points in iter_events():
      for point in points:
        closest = min(clusters, key=lambda c: dist(c.init_centre, point))
        if event not in closest.events:
          closest.events.add(event)
          closest.count += 1
        updateAvgGeoPoint(closest.centre, point, closest.count)
        add_event_to_cluster(event, closest.id, detail_level)

  for detail_level, clusters in all_clusters.iteritems():
    for cluster in clusters:
      print >> sys.stderr, "cluster %i at detail level %i: centre %f, %f initial size %i final size %i" % (cluster.id, detail_level, cluster.centre[0], cluster.centre[1], cluster.init_count, cluster.count)
      set_cluster_info(detail_level, cluster.id, cluster.centre)
