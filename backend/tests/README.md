Testing queries (queries/)
==========================

The scripts in queries/ can do automated testing of queries, such as for
regression testing. The test system is based on having separate directories of
query files with the desired constraint sets and view sets, and runs pairwise
tests. The example query files can serve as suitable input.

For example, say we have an index test.index containing our data and start a
local backend serving it. We can run:
	./tests/queries/run examplequeries/constraints/ examplequeries/views/ querydb.out ./querydb test.index
	./tests/queries/run examplequeries/constraints/ examplequeries/views/ querybackend.out ./querybackend http://localhost:1500
	./tests/queries/compare querydb.out querybackend.out querydb-vs-querybackend.diff

Testing backend server settings (settings/)
===========================================

The tests for the backend server settings include settings files and a
semi-automated testing script. The tests are especially intended to make sure
that the settings reload timeout and possible index changes work properly while
the server is running.

To use the semi-automated testing script, in some clean directory create
indexes in directories first.index, second.index, and third.index so that the
same query will produce obviously different results on the three indexes. For
example, the results for examplequeries/views/descriptions.json will have
distinct numbers of different hits and distinct byte sizes at the receiving end
if you put 10, 20, and 30 events in the three indexes respectively and leave
the description page size at 50.

In the same directory run the script and pass it the path to the test files
directory. When prompted, start the backend server on the settings.conf
settings file the script produces, and use querybackend to run repeated queries
at small delays (eg -r 1000 -s 1, using examplequeries/views/descriptions.json
if the three indexes were created as suggested above). Watch the output from
both for the expected changes (with the delay for the settings reload timeout)
as indicated by the script.
