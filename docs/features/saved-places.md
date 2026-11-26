# Saved places

Signed in, the places saved in the [route planner](route-planner.md) (the
account's `savedPlaces`, `route-history.js`) are kept with their location:
a Google place's is fetched when it's saved, and one saved before that is
looked up by its place ID when the map shows it.

## On the map

`saved-places-layer.js` shows each saved place as a round pin with its icon
(Home, Work, School, Star, Heart or Pin) and its name as the pin's title,
under the chargers' pins, which stay clickable. The pins follow every change
to the places (`saved-places-change` on the document) and the session.

The account menu's **Saved places on the map** switch
(`<ev-saved-places-setting>`, signed in only) turns them off and on; they're
on by default. The choice is kept like the other account-menu preferences
(`src/lib/saved-places-on-map.js`, `account-preference.js`): on this device
and in the account's `savedPlacesOnMap` section (`{ shown, updatedAt }`).

## My saved places

`/{lang}/places/`, linked from the account menu, lists the saved places
(`<ev-saved-places-page>`): each can be renamed, given another icon, or
removed, and the map shows them as they are now. Signed out, the page asks
to sign in. Usage reports don't count it, like the user's suggestions page.
