#!/usr/bin/env python2

"""
Runs the backend as a server.

To see the available options, use --help
"""

import sys
import os
import logging
import logging.handlers
import tarfile

import whoosh
import whoosh.index
import queries

import click
import requests

from werkzeug.wrappers import BaseRequest
from werkzeug.wrappers import Response
from werkzeug.exceptions import BadRequest
from werkzeug.utils import cached_property
from werkzeug.contrib.cache import RedisCache

try:
    import simplejson as json
except ImportError:
    import json

# import backend_settings
# import backend_settings_defaults
# handles which domain to choose based on environment variables internally
from domain_config import domain_config

# TODO: Also output to stdout when not running in Docker
logger = logging.getLogger("query-logger")

syslog_handler = logging.handlers.SysLogHandler(address='/run/rsyslog/rsyslog.sock')
syslog_handler.setLevel(logging.INFO)

stream_handler = logging.StreamHandler(sys.stdout)
stream_handler.setLevel(logging.DEBUG)

log_formatter = logging.Formatter("%(name)s - %(levelname)s: %(message)s")
syslog_handler.setFormatter(log_formatter)
stream_handler.setFormatter(log_formatter)

logger.addHandler(syslog_handler)
logger.addHandler(stream_handler)
logger.setLevel(logging.DEBUG)

# TODO: try to use JSONRequestMixin
#       It currently doens't work because we're getting the json in request.form
#       not in request.data
class QueryRequest(BaseRequest):
    # we shouldn't get a query that's more than 2M
    max_content_length = 2 * 1024 * 1024

    @cached_property
    def json(self):
        try:
            return json.loads(self.form.items()[0][0])
        except ValueError:
            # Let the user deal with the exception and respond with an
            # appropriate error message.
            # We're using BadRequest here to be consistent with the other
            # request wrappers provided by werkzeug.
            raise BadRequest("Invalid json")


def create_app(index, redis_address, redis_port):
    """ Creates an app, given an index path."""
    try:
        whoosh_index = whoosh.index.open_dir(index)
    except whoosh.index.EmptyIndexError:
        logger.error("No index found at {}".format(index))
        sys.exit(1)
    cache = RedisCache(redis_address, port=redis_port, default_timeout=0,
                       key_prefix="query_cache")
    querier = queries.Querier(whoosh_index, cache,
                              **domain_config.settings.get('querier', {})) # noqa

    querier.prime()

    @QueryRequest.application
    def application(request):
        email = request.cookies.get("email", "no-email")
        tracking_code = request.cookies.get("tracking", "")
        log_tracker = '[' + email + ' ' + tracking_code + ']'

        querier = queries.Querier(whoosh_index, cache,
                                  tracking_code=log_tracker,
                                  **domain_config.settings.get('querier', {}))

        try:
            query = request.json
        except BadRequest, e:
            logger.warn(e)
            return Response('{ "status": "error", "message": "invalid json" }',
                            mimetype='application/json', status=400)

        query_response = querier.handle(query)

        response = Response(json.dumps(query_response),
                            mimetype='application/json')
        response.headers.add('Access-Control-Allow-Origin', '*')

        return response

    return application


@click.command()
@click.option('--hostname', default="0.0.0.0",
              help="the hostname to bind to")
@click.option('-p', '--port', default=1500, type=int,
              help="the port to bind to")
@click.option('-r', '--redis', default="localhost:6379",
              help="address of the Redis server.")
@click.argument('index', type=click.Path(exists=True))
def main(hostname, port, index, redis):
    from werkzeug.serving import run_simple

    # add default redis port to the end in case it's not already there
    # if it's already there, it's going to be ignored, so it's not an issue
    redis_host = (redis + ":6379").split(":")
    redis_address = redis_host[0]
    redis_port = int(redis_host[1])

    app = create_app(index, redis_address, redis_port)
    # XXX: Make sure threaded=False since Whoosh isn't as threadsafe as it
    # should be. You'll get the following issue:
    # https://bitbucket.org/mchaput/whoosh/issues/400/runtimeerror-dictionary-changed-size
    run_simple(hostname, port, app, threaded=False)

if __name__ == '__main__':
    main()
# this env variable is set in our uWSGI config
elif os.environ.get("RUNNING_IN_UWSGI", False):
    logger.debug("RUNNING_IN_UWSGI")
    # TODO change this to an env variable once docker-compose supports
    # build-time env vars
    INDEX_PATH = "/data/index/fullData.index"
    INDEX_TAR = INDEX_PATH + ".tar"

    INDEX_URI = os.environ.get("INDEX_URI",
            "https://s3.amazonaws.com/lensing.80x24.ca/fullData.index.tar")

    if not os.path.exists(INDEX_PATH):
        logger.debug("downloading index tar")
        r = requests.get(INDEX_URI, stream=True)
        with open(INDEX_TAR, 'wb') as f:
            for chunk in r.iter_content(chunk_size=1024):
                if chunk:
                    f.write(chunk)

        logger.debug("finished downloading index tar")

        with tarfile.TarFile(INDEX_TAR) as index_tar:
            # XXX this expects that the only thing in the tarball is a dir
            # called "fullData.index"
            index_tar.extractall("/data/index")

        logger.debug("extracted index tar")

    app = create_app(INDEX_PATH, 'redis', '6379')
