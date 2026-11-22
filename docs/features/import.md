# Import

## Import

Every 15 minutes, the Worker's scheduled handler
(`packages/worker/src/import/`) works through due import jobs: Open Charge
Map one country per job (Eastern Europe first; only openly licensed data providers)
and OpenStreetMap one 1°×1° cell of Eastern Europe per job (via Overpass).
Each area is refreshed weekly; chargers a source no longer lists are
removed. Every charger keeps its source and license.

## Countries

Open Charge Map gives each charger's country; OpenStreetMap
chargers get it from their location, with
[country-coder](https://github.com/rapideditor/country-coder).
