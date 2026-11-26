// The icons a saved place can have (route-history.js's SAVED_PLACE_ICONS),
// for the route planner's chips, the map's pins and the saved places page.
import { Briefcase, GraduationCap, Heart, House, MapPin, Star } from "lucide-static";

const savedPlaceIcons = [
  { id: "home", icon: House },
  { id: "work", icon: Briefcase },
  { id: "school", icon: GraduationCap },
  { id: "star", icon: Star },
  { id: "heart", icon: Heart },
  { id: "pin", icon: MapPin },
];

export { savedPlaceIcons };
