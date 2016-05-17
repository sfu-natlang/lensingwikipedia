import os
DOMAIN = os.environ.get('LENSING_DOMAIN', 'wikipediahistory')

import avherald.domain_config
import wikipediahistory.domain_config

if DOMAIN == 'avherald':
    _import_from = avherald
else:
    _import_from = wikipediahistory

domain_config = _import_from.domain_config
