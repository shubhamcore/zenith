# Data sources

ZENITH only uses **public** feeds. No scraping of private systems. No classified data.

| Layer | What you see | Source | Auth |
| --- | --- | --- | --- |
| Globe | Day / night / specular / cloud textures | three.js planet textures (NASA Visible Earth lineage) | none |
| Earthquakes | M2.5+ last 24 hours | [USGS](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) | none · CORS open |
| Space weather | Planetary Kp, solar wind speed | [NOAA SWPC](https://www.swpc.noaa.gov/) | none · CORS open |
| Aurora oval | OVATION Prime forecast | [NOAA SWPC ovation](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast) | none · CORS open |
| Satellites | SGP4 from a CelesTrak snapshot + live station refresh | [CelesTrak](https://celestrak.org/) | none · live refresh via local proxy |
| Space stations | ISS (Zarya) and Tiangong (Tianhe) | CelesTrak `stations` | none |
| Launches | Next 12 orbital attempts | [Launch Library 2](https://thespacedevs.com/) | none |
| Air picture | Sampled ADS-B contacts | [OpenSky Network](https://opensky-network.org/) | none · **local proxy required** (no CORS) |
| ISS passes | Look angles over Bihta | CelesTrak TLE + satellite.js SGP4 | none · computed locally |

## Honesty notes

- Satellite positions are **propagated** from published TLEs, not radar tracks.
- The air picture is **public ADS-B**, downsampled, and only appears when you run `npm run dev` or `npm start`.
- Aurora points are the official OVATION grid, filtered to meaningful intensity.
- Earthquake locations are USGS hypocenters.
- Launch pad pins use published coordinates from The Space Devs.

If a feed is down, ZENITH degrades: the globe still runs, the briefing says so.
