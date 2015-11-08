import os
DOMAIN = os.environ.get('LENSING_DOMAIN', 'wikipediahistory')

import avherald.backend_domain_config
import avherald.backend_domain_settings_defaults

import wikipediahistory.backend_domain_config
import wikipediahistory.backend_domain_settings_defaults

if DOMAIN == 'avherald':
    _import_from = avherald
else:
    _import_from = wikipediahistory

backend_domain_config = _import_from.backend_domain_config
backend_domain_settings_defaults = _import_from.backend_domain_settings_defaults
