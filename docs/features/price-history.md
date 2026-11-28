# Price history

Chargers' prices are stored hourly where a source publishes live prices
(EIPA, in Poland) (`packages/worker/src/charger-prices.js`, #463). The first
live status refresh of each hour (`src/live-status.js`) reuses its download:
each charger's cheapest price per kWh is compared with its latest
(`charger_price_latest`), and only the changes go into `charger_prices`
(a row is the price from that hour until the next row; null while the source
publishes none), so an hour is a few writes. `charger_price_runs` says when
each source was last gathered: a charger's history runs until then. Changes
older than 90 days are deleted in the 03:00 UTC run, but never a charger's
latest, which is still its price.

## Charger details

Signed in, as live availability, the charger details ask
`GET /api/chargers/prices?ids=eipa:1` for the charger's last 30 days
(`components/google-map/price-history.js`). The Worker expands the changes
to one price per hour and works out the pattern: the usual (average) price,
the lowest and highest, and, after at least 72 hours with a price, the
average of each hour of the day and day of the week in the source's time
zone (Europe/Warsaw). An hour or day 10% or more from the usual is much
cheaper or pricier. The **Price history** section says the usual price, how
the price now compares, the cheaper and pricier hours and days, and shows a
bar per hour of the day, green where it's much cheaper and red where it's
much pricier. Chargers without a history (other sources, or none yet) don't
show it.

## Admin

`/{lang}/admin/prices/` (Insights), rendered on the server with
`GET /api/admin/prices`: how many chargers have a price, how many changed in
the last day, when prices were last gathered, and the latest 50 changes. A
charger's ID (`?charger=eipa:1`, or a change's link) shows its last 30 days:
its usual, lowest, highest and current price, its averages by hour and by
day (much cheaper green, much pricier red), and its changes.
