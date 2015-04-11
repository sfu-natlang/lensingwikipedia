Lensing Wikipedia
=================

For information about the developers for this project, see the AUTHORS file.

Simon Fraser University, School of Computing Science  
Burnaby, BC V5A 1S6, Canada

For license information, see the LICENCE file.

There are four main parts:
- Data preparation (`data-preparation/`). Creates a data file.
- Backend (`backend/`). Uploads the data file to a database and serves a query
  system against this data.
- Frontend (`frontend/`) or more recently Web (`web/`). Web interface which visualizes the data, querying the
  backend.
- Domain code (`domains/*`). Domain-specific code which uses the above.

See the documentation in the respective directories for more information. To
set up the complete system follow the usage directions for each part in
sequence.
